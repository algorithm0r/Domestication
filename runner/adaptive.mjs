// adaptive.mjs <settings.json> [collection] — adaptive replication driver.
// Enqueues N0 reps per setting, waits for the cluster to drain, pulls results from Mongo,
// and tops up only the settings whose CIs aren't tight yet (per stats.mjs), until every
// setting is sufficient or hits N_MAX. Minimum runs for uniformly-defensible precision.
//
// settings.json: [{ id, config }]  — id is the base run id; reps get _rNN suffixes.
// Requires a Mongo-mode coordinator (MONGO_COLLECTION set) + workers running.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';
import { evaluate } from './stats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const COLL = process.argv[3] || 'domestication-final-2026';
const COORD = process.env.COORD || 'http://localhost:8088';
const N0 = parseInt(process.env.N0 || '5');           // initial reps per setting
const NMAX = parseInt(process.env.NMAX || '60');      // cap (boundary cells)
const POLL = parseInt(process.env.POLL || '30000');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rep = (id, i) => `${id}_r${String(i).padStart(2, '0')}`;

const enqueued = {};                                  // setting.id -> count enqueued so far
async function enqueueReps(s, from, count) {
  const runs = [];
  for (let i = from; i < from + count; i++) runs.push({ id: rep(s.id, i), config: s.config });
  await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
  enqueued[s.id] = from + count - 1;
}
async function counts() { try { return (await (await fetch(COORD + '/status')).json()).counts; } catch { return null; } }
async function waitForDrain() {
  while (true) { const c = await counts(); if (c && c.pending === 0 && c.running === 0) return; await sleep(POLL); }
}

const socket = connect();
socket.on('connect_error', e => { console.log('mongo connect_error:', e.message); process.exit(1); });
socket.on('connect', async () => {
  for (const s of SETTINGS) s.key = settingKey(s.config);     // group replicates by canonical config
  console.log(`adaptive: ${SETTINGS.length} settings -> collection "${COLL}", N0=${N0}, N_MAX=${NMAX}`);
  for (const s of SETTINGS) await enqueueReps(s, 1, N0);       // seed
  console.log(`seeded ${SETTINGS.length * N0} runs; waiting for completion...`);

  let round = 0;
  while (true) {
    round++;
    await waitForDrain();
    const docs = await findAll(socket, COLL, {}, { dome: 1, setting: 1 });
    const byKey = {};                                         // settingKey -> [dome]
    for (const d of docs) if (d.setting && d.dome != null) (byKey[d.setting] ||= []).push(d.dome);

    let added = 0, done = 0;
    for (const s of SETTINGS) {
      const ev = evaluate(byKey[s.key] || []);
      if (ev.enough) { done++; continue; }
      const target = Math.min(NMAX, ev.nNeeded);
      const have = enqueued[s.id] || 0;
      if (have < target) { await enqueueReps(s, have + 1, target - have); added += target - have; }
    }
    console.log(`round ${round}: ${done}/${SETTINGS.length} settings sufficient; enqueued ${added} top-up reps`);
    if (added === 0) break;                                   // converged (all sufficient or capped at N_MAX)
  }
  console.log(`\nDONE. run "node pull.mjs ${COLL}" for the final aggregate.`);
  socket.close(); process.exit(0);
});
