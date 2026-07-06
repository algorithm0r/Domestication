// gen-energy-queue.mjs — build the energy×pop re-run queue for the coordinator.
// mt{10,20,30,40,50} × pop{10..100}, all-plant + a numPlanters=0 baseline per cell, N reps.
// DOVETAILED, baselines-first: rep 1 = all baselines then all plant, then rep 2, etc.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ENERGY = [10, 20, 30, 40, 50];
const POP = []; for (let p = 10; p <= 120; p += 10) POP.push(p);
const REPS = parseInt(process.env.REPS || '3');
const EPOCH = parseInt(process.env.EPOCH || '100000');
const BASE = { epoch: EPOCH, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom', plantSelectionStrength: 0.2, plantSelectionChance: 1 };
const p3 = v => String(v).padStart(3, '0');

const runs = [];
for (let r = 1; r <= REPS; r++) {
  for (const e of ENERGY) for (const p of POP)
    runs.push({ id: `eg_mt${p3(e)}_pop${p3(p)}_pl000_r${p3(r)}`, config: { ...BASE, metabolicThreshold: e, humanAddRate: p, numPlanters: 0 } });   // baseline
  for (const e of ENERGY) for (const p of POP)
    runs.push({ id: `eg_mt${p3(e)}_pop${p3(p)}_pl${p3(p)}_r${p3(r)}`, config: { ...BASE, metabolicThreshold: e, humanAddRate: p, numPlanters: p } });   // all-plant
}
fs.writeFileSync(path.join(HERE, 'energy-queue.json'), JSON.stringify(runs));
console.log(`wrote energy-queue.json: ${runs.length} runs (${ENERGY.length}×${POP.length} cells × 2 × ${REPS} reps), epoch ${EPOCH}`);
