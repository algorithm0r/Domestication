// gen-sweep.mjs — emit a population x #planters grid as runlist.json (full 150k).
// harvesters = predation; planters (<= harvesters) = planting effort. Plant first-harvested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rng = (a, b, s) => { const o = []; for (let x = a; x <= b; x += s) o.push(x); return o; };
const POPS     = rng(10, 200, 10);          // harvesters
const PLANTERS = rng(0, 200, 10);           // planters (<= harvesters)
const BASE = {
  epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
};

const runs = [];
let skipped = 0;
for (const pop of POPS)
  for (const np of PLANTERS)
    if (np <= pop) {
      const id = `pop${pop}_pl${np}`;
      if (fs.existsSync(path.join(HERE, 'results', id + '.json'))) { skipped++; continue; }  // already have it
      runs.push({ id, config: { ...BASE, humanAddRate: pop, numPlanters: np } });
    }

fs.writeFileSync(path.join(HERE, 'runlist.json'), JSON.stringify(runs, null, 1));
console.log(`wrote ${runs.length} runs (skipped ${skipped} already-done); dense 60-200 x 0-200 step 10, full 150k`);
