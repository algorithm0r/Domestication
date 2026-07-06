// gen-energy-batch.mjs — the energy exploration batch:
//   (1) energy × pop grid: metabolicThreshold {10..60} × pop {40..140} (all-plant anchor)
//   (2) finer energy at pop80: {5,15,25,35,45,55} to localize the optimum
//   (3) peak replication: {15,20,25} × 10 reps at pop80, for error bars
// Anchor: bottom, all plant, saved 0.20, selective 1.0. Skips grid/finer cells already on disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ANCHOR = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
  numPlanters: 1e9, plantSelectionStrength: 0.20, plantSelectionChance: 1.0 };
const mt2 = m => String(m).padStart(2, '0');
const exists = id => fs.existsSync(path.join(HERE, 'results', id + '.json'));

const POPS = [40, 60, 80, 100, 120, 140];
const GRID_MT = [10, 20, 30, 40, 50, 60];
const FINE_MT = [5, 15, 25, 35, 45, 55];
const REP_MT  = [15, 20, 25];

const runs = [];
let skip = 0;
// (1) energy × pop grid
for (const pop of POPS) for (const mt of GRID_MT) {
  const id = `energy_pop${pop}_mt${mt2(mt)}`;
  if (exists(id)) { skip++; continue; }
  runs.push({ id, config: { ...ANCHOR, humanAddRate: pop, metabolicThreshold: mt } });
}
// (2) finer energy at pop80
for (const mt of FINE_MT) {
  const id = `energy_pop80_mt${mt2(mt)}`;
  if (exists(id)) { skip++; continue; }
  runs.push({ id, config: { ...ANCHOR, humanAddRate: 80, metabolicThreshold: mt } });
}
// (3) peak replication at pop80 (always fresh ids)
for (const mt of REP_MT) for (let r = 1; r <= 10; r++)
  runs.push({ id: `erep_pop80_mt${mt2(mt)}_r${String(r).padStart(2, '0')}`,
              config: { ...ANCHOR, humanAddRate: 80, metabolicThreshold: mt } });

fs.writeFileSync(path.join(HERE, 'energy-batch.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} runs (skipped ${skip} existing): energy×pop grid + finer pop80 + ${REP_MT.length}×10 replication`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
