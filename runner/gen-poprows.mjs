// gen-poprows.mjs — add whole population rows to every pop-varying sweep at the new anchor.
// For each pop in POPS: energy×pop (mt{10..50}, all-plant + numPlanters=0 baseline), planters×pop,
// saved%×pop, selective%×pop. Internally deduped by settingKey (shared anchor/baseline cells run
// once). Dovetailed, baselines-first, N reps. Appends to the coordinator queue (FIFO -> runs after
// the current pending drains). Paper/lineage are pop80-only, so not touched here.
//   POPS=110,120  REPS=3  DRY=1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POPS = (process.env.POPS || '110,120').split(',').map(Number);
const REPS = parseInt(process.env.REPS || '3');
const DRY = process.env.DRY === '1';
const COORD = process.env.COORD || 'http://localhost:8088';
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const A = { harvestStrategy: 'random', plantStrategy: 'bottom', metabolicThreshold: 20, plantSelectionStrength: 0.20, plantSelectionChance: 1.0 };
const ENERGY = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
const SELECTIVE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const ALL = 1e9;
const p3 = v => String(v).padStart(3, '0');
const p4 = v => String(Math.round(v * 1000)).padStart(4, '0');

// MERGE mode: append the deduped settings straight into a settings-driven coordinator file
// (coordinator2.mjs's flat {id,config} list) instead of FIFO-enqueuing reps. Existing settingKeys
// are seeded into `seen` first, so only genuinely new cells are appended and the adaptive coordinator
// tops them to MIN_N on its own. This is the pop-row path for the settings-driven framework.
const MERGE = process.env.MERGE || '';
const existing = MERGE ? JSON.parse(fs.readFileSync(MERGE, 'utf8')) : [];

const settings = [];
const seen = new Map();
for (const e of existing) seen.set(settingKey(e.config), e.id);   // don't re-add a cell some other id already covers
function add(id, cfg) {
  const full = { ...BASE, harvestStrategy: 'none', plantStrategy: 'none', humanAddRate: 0, numPlanters: 0, metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1.0, ...cfg };
  full.numPlanters = Math.min(full.numPlanters, full.humanAddRate);
  const key = settingKey(full);
  if (seen.has(key)) return; seen.set(key, id);
  settings.push({ id, config: full, base: full.numPlanters === 0 });
}
// energy×pop + per-cell numPlanters=0 baseline
for (const pop of POPS) for (const mt of ENERGY) {
  add(`eg_mt${p3(mt)}_pop${p3(pop)}_pl000`,      { ...A, humanAddRate: pop, numPlanters: 0,   metabolicThreshold: mt });
  add(`eg_mt${p3(mt)}_pop${p3(pop)}_pl${p3(pop)}`, { ...A, humanAddRate: pop, numPlanters: ALL, metabolicThreshold: mt });
}
// planters × pop / saved% × pop / selective% × pop (mt20)
for (const pop of POPS) for (let np = 0; np <= pop; np += 10) add(`pp_pop${pop}_pl${np}`, { ...A, humanAddRate: pop, numPlanters: np });
for (const pop of POPS) for (const s of SAVED)     add(`saved_pop${pop}_s${p4(s)}`, { ...A, humanAddRate: pop, numPlanters: ALL, plantSelectionStrength: s });
for (const pop of POPS) for (const c of SELECTIVE) add(`sel_pop${pop}_c${p4(c)}`,   { ...A, humanAddRate: pop, numPlanters: ALL, plantSelectionChance: c });

const bases = settings.filter(s => s.base), plants = settings.filter(s => !s.base);
console.log(`pops ${POPS.join(',')}: ${settings.length} NEW cells (${bases.length} baseline, ${plants.length} planting)`);

if (MERGE) {
  const merged = existing.concat(settings.map(s => ({ id: s.id, config: s.config })));
  console.log(`MERGE: ${existing.length} existing + ${settings.length} new = ${merged.length} settings -> ${MERGE}`);
  if (DRY) { console.log('DRY — not written'); process.exit(0); }
  fs.writeFileSync(MERGE, JSON.stringify(merged));
  console.log('written. Restart coordinator2 on this file; it rebuilds bins from Mongo and tops the new cells to MIN_N.');
  process.exit(0);
}

const runs = [];   // dovetail: baselines first within each rep
for (let r = 1; r <= REPS; r++) {
  for (const s of bases)  runs.push({ id: `${s.id}_r${p3(r)}`, config: s.config });
  for (const s of plants) runs.push({ id: `${s.id}_r${p3(r)}`, config: s.config });
}
console.log(`${runs.length} runs (× ${REPS} reps), dovetailed baselines-first`);
fs.writeFileSync(path.join(HERE, 'poprows-queue.json'), JSON.stringify(runs));

if (DRY) { console.log('DRY — not enqueued'); process.exit(0); }
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
