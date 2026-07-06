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
const ENERGY = [10, 20, 30, 40, 50];
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
const SELECTIVE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const ALL = 1e9;
const p3 = v => String(v).padStart(3, '0');
const p4 = v => String(Math.round(v * 1000)).padStart(4, '0');

const settings = [];
const seen = new Map();
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
console.log(`pops ${POPS.join(',')}: ${settings.length} cells (${bases.length} baseline, ${plants.length} planting)`);

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
