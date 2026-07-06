// gen-energy.mjs — 1D sweep of human metabolic energy on the anchor setting.
// anchor (measure_dup.mjs): harvest random + plant bottom-of-basket, 100 harvesters,
// all planting — sits in the domesticated band, so the energy response is visible.
// Full-length sweep schedule (150k / 25k / 50k). Sweeps metabolicThreshold (default 30):
// the energy a human expends before returning to rest = how much work per cycle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const POP = 80;                                   // sweet spot: induced dome 0.357, baseline only 0.022
const ANCHOR = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
  humanAddRate: POP, numPlanters: 1e9 };          // POP harvesters, all plant

const LEVELS = [10, 20, 30, 40, 50, 60];          // metabolicThreshold; 30 = default
const runs = LEVELS.map(mt => ({
  id: `energy_pop${POP}_mt${String(mt).padStart(2, '0')}`,
  config: { ...ANCHOR, metabolicThreshold: mt },
}));

fs.writeFileSync(path.join(HERE, 'energy.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} energy runs (metabolicThreshold ${LEVELS.join(', ')}) on anchor pop${POP}/all-plant/bottom`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
