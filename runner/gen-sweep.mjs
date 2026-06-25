// gen-sweep.mjs — emit a population x #planters grid as runlist.json (full 150k).
// harvesters = predation; planters (<= harvesters) = planting effort. Plant first-harvested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POPS     = [40, 80, 120, 160, 200];          // harvesters
const PLANTERS = [0, 40, 80, 120, 160, 200];        // planters (capped at harvesters)
const BASE = {
  epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
};

const runs = [];
for (const pop of POPS)
  for (const np of PLANTERS)
    if (np <= pop)
      runs.push({ id: `pop${pop}_pl${np}`, config: { ...BASE, humanAddRate: pop, numPlanters: np } });

fs.writeFileSync(path.join(HERE, 'runlist.json'), JSON.stringify(runs, null, 1));
console.log(`wrote ${runs.length} runs (population x #planters, full 150k)`);
