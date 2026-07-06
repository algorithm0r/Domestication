// gen-energy-baselines.mjs — pure-harvester (numPlanters=0) baselines ACROSS the energy grid,
// so the energy×pop heatmap can be per-(pop,energy) baseline-corrected (not just at energy 15).
// Energy-15 baselines already exist (the pp_pop{pop}_pl0 cells); we only fill the other energies.
// FULL pop range (every-10, 10..140) so every row of the energy fig is properly corrected.
// /enqueue is 1:1 (no auto-replication), so we emit REPS explicit _rNN ids per setting; they
// aggregate together by settingKey. Idempotent: re-running dedups by id at the coordinator
// (so a prior 60..140 enqueue is reused and only the new rows are added).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const BASE = { epoch: 150000, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom',     // anchor background
  numPlanters: 0,                                          // <-- no planting = the baseline
  plantSelectionStrength: 0.2, plantSelectionChance: 1 };

const POPS    = []; for (let p = 10; p <= 140; p += 10) POPS.push(p);   // full every-10, all rows corrected
const ENERGY  = [5, 10, 20, 25, 30, 40, 50, 60, 70];       // skip 15 — covered by pp_pop{pop}_pl0
const REPS    = 5;
const p2 = v => String(v).padStart(2, '0');

const runs = [];
for (const pop of POPS) for (const mt of ENERGY) {
  const config = { ...BASE, humanAddRate: pop, metabolicThreshold: mt };
  for (let r = 1; r <= REPS; r++) runs.push({ id: `enbase_pop${pop}_mt${p2(mt)}_r${p2(r)}`, config });
}

fs.writeFileSync(path.join(HERE, 'energy-baselines.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} energy-baseline runs: ${POPS.length} pops × ${ENERGY.length} energies × ${REPS} reps (no-planting, numPlanters=0)`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
