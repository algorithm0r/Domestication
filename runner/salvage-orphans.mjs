// salvage-orphans.mjs — re-post completed-but-unrecorded run outfiles (overnight orphans) to the
// coordinator so their data lands in Mongo and the runs are marked done, instead of recomputing.
// The worker writes its outfile BEFORE posting /complete; an interrupted worker leaves the data on
// disk. /complete is idempotent (runId-keyed insert), so re-posting can't duplicate. Local files are
// KEPT as backup (not deleted) — clean results/ manually once the DB is confirmed.
// Usage: node salvage-orphans.mjs            (COORD env overrides coordinator URL)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COORD = process.env.COORD ?? 'http://localhost:8088';
const RESULTS = path.join(HERE, 'results');
const STATE = path.join(HERE, 'production-state.json');

const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
const status = {}; for (const r of (st.runs || st)) status[r.id] = r.status;

// only salvage orphan files whose run is still pending/running and whose data is valid
const targets = [];
for (const f of fs.readdirSync(RESULTS).filter(f => /^enbase_.*\.json$/.test(f))) {
  const id = f.replace(/\.json$/, '');
  const s = status[id];
  if (s !== 'pending' && s !== 'running') continue;              // skip done/error/unknown
  let o; try { o = JSON.parse(fs.readFileSync(path.join(RESULTS, f), 'utf8')); } catch { continue; }
  if (!o || !o.data || !o.data.domeSeedPop) continue;            // skip partial/corrupt
  targets.push({ id, o });
}
console.log(`salvaging ${targets.length} orphan outfiles -> ${COORD}`);

const post = (p, body) => fetch(COORD + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(r => r.json()).catch(e => ({ __err: String(e) }));

let ok = 0, fail = 0, done = 0;
const queue = targets.slice();
async function run() {
  while (queue.length) {
    const t = queue.pop();
    const resp = await post('/complete', { id: t.id, worker: 'salvage', host: 'salvage', stats: t.o.stats || null, result: t.o });
    if (resp && !resp.__err) ok++; else { fail++; console.log('  FAIL', t.id, (resp && resp.__err) || ''); }
    if (++done % 25 === 0) console.log(`  ${done}/${targets.length}...`);
  }
}
await Promise.all(Array.from({ length: 2 }, run));               // low concurrency — gentle on the memory-pressured DB box
console.log(`\nsalvage complete: ${ok} posted, ${fail} failed (local files kept as backup)`);
