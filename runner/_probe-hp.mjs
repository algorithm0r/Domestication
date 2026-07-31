// _probe-hp.mjs — check whether harvested/planted/gsp event fields exist and carry data in Mongo for the
// experiments whose CSVs came out empty/missing (01, 03, 10) vs a known-good one (12, 20).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const byId = {}; for (const s of settings) byId[s.id] = s;
const MAP = { '01': 'p01_nohumans', '02': 'p02_wt2_predation', '03': 'p03_wt3_plantrandom', '10': 'p10_harv_minWeight', '12': 'p12_plant_maxRoots', '20': 'p20_plant_bottom' };
const FIELDS = ['rootData', 'gspData', 'harvestedRootData', 'harvestedGspData', 'plantedRootData', 'plantedGspData'];
const PROJ = Object.fromEntries(FIELDS.map(f => [f, 1]));

function summarize(docs, field) {
  let present = 0, nonzero = 0, sample = null;
  for (const d of docs) {
    const a = d[field];
    if (a === undefined || a === null) continue;
    present++;
    if (Array.isArray(a)) {
      let s = 0; for (const r of a) if (Array.isArray(r)) for (const v of r) s += (v || 0);
      if (s > 0) nonzero++;
      if (sample === null) sample = `len=${a.length}`;
    } else sample = `type=${typeof a}`;
  }
  return `present=${present}/${docs.length}  nonzero=${nonzero}  ${sample || ''}`;
}

const socket = connect();
let done = false;
socket.on('connect_error', e => { if (!done) { console.log('connect_error', e.message); process.exit(1); } });
socket.on('connect', async () => {
  if (done) return; done = true;
  for (const [nn, id] of Object.entries(MAP)) {
    const cfg = byId[id];
    if (!cfg) { console.log(`\n${nn} (${id}): NO SETTING in settings.json`); continue; }
    const key = settingKey(cfg.config);
    const docs = await findAll(socket, COLL, { setting: key }, PROJ);
    console.log(`\n=== ${nn}  ${id}  (${docs.length} docs) ===`);
    for (const f of FIELDS) console.log(`  ${f.padEnd(18)} ${summarize(docs, f)}`);
  }
  socket.close(); process.exit(0);
});
setTimeout(() => { console.log('watchdog timeout'); process.exit(1); }, 120000);
