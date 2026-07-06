// gen-baselines.mjs — pure-harvester (no-planting) baselines at energy 20, for correcting
// the energy-20 crosses. numPlanters:0 => humans harvest (predation) but none plant = WT2.
// Subtracting these removes the WT1 low-population artifact from each cross cell.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const BASE = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
  numPlanters: 0, metabolicThreshold: 20 };          // numPlanters 0 = no planting

const POPS = [40, 60, 80, 100, 120, 140];
const runs = POPS.map(pop => ({ id: `base_e20_pop${pop}`, config: { ...BASE, humanAddRate: pop } }));

fs.writeFileSync(path.join(HERE, 'baselines.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} energy-20 no-planting baselines: pop {${POPS.join(', ')}}`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
