// gen-topup-all.mjs — bring EVERY setting in settings.json up to a flat N=TARGET replicates.
// Generalizes gen-paper-topup.mjs (which only covered p*/lin_) to the whole canonical set:
// the sweeps (pp/saved/sel/en) plus paper/lineage. Aggregation is by settingKey(config), so
// current counts are read LIVE from Mongo (not a stale manifest); extra reps carry the exact
// settings.json config and pool into the existing group. Continues the _rNN sequence from the
// current count. Idempotent: coordinator dedups by id, and settings already at N=TARGET add 0.
//
// Usage:  node gen-topup-all.mjs [collection]        (enqueues)
//         DRY=1 node gen-topup-all.mjs [collection]  (report only, no enqueue)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const TARGET = parseInt(process.env.TARGET || '10');
const DRY = process.env.DRY === '1';
const COORD = process.env.COORD || 'http://localhost:8088';
const p2 = v => String(v).padStart(2, '0');

const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));

const socket = connect();
socket.on('connect_error', e => { console.log('connect_error:', e.message); process.exit(1); });
socket.on('connect', async () => {
  const docs = await findAll(socket, COLL, {}, { setting: 1 });
  const cnt = new Map();
  for (const d of docs) if (d.setting) cnt.set(d.setting, (cnt.get(d.setting) || 0) + 1);

  const runs = [];
  let touched = 0, alreadyOk = 0;
  const byPrefix = {};                       // prefix -> reps added (sanity view)
  for (const s of settings) {
    const key = settingKey(s.config);
    const have = cnt.get(key) || 0;
    if (have >= TARGET) { alreadyOk++; continue; }
    touched++;
    for (let i = have + 1; i <= TARGET; i++) runs.push({ id: `${s.id}_r${p2(i)}`, config: s.config });
    const pre = (s.id.match(/^[a-z]+/i) || [s.id])[0];
    byPrefix[pre] = (byPrefix[pre] || 0) + (TARGET - have);
  }

  console.log(`collection: ${COLL}  target N=${TARGET}`);
  console.log(`settings: ${settings.length} total; ${alreadyOk} already >= N; ${touched} need top-up`);
  console.log(`reps to enqueue: ${runs.length}  by id-prefix: ${JSON.stringify(byPrefix)}`);
  fs.writeFileSync(path.join(HERE, 'topup-all.json'), JSON.stringify(runs, null, 0));
  console.log(`wrote record -> runner/topup-all.json (${runs.length} runs)`);

  if (DRY) { console.log('DRY run — nothing enqueued.'); socket.close(); process.exit(0); }
  if (runs.length === 0) { console.log('nothing to enqueue.'); socket.close(); process.exit(0); }

  const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
  console.log('enqueue ->', JSON.stringify(await res.json()));
  socket.close(); process.exit(0);
});
