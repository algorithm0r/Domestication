// gen-cross-selective.mjs — second coordinate-ascent cross: selective% × pop.
// Anchor: bottom-of-basket, all plant, energy=20, saved%(plantSelectionStrength)=0.20 (validated).
// Vary plantSelectionChance (fraction of planting events that use the selective 'bottom'
// rule vs random) and population (capped at 140). chance=0 -> fully random planting (no
// geographic selection, ~WT3); chance=1.0 -> always bottom-of-basket. Expected peak at 1.0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ANCHOR = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
  numPlanters: 1e9, metabolicThreshold: 20, plantSelectionStrength: 0.20 };  // all plant, energy 20, saved 0.20

const CHANCE = [0.0, 0.25, 0.50, 0.75, 1.0];          // plantSelectionChance; 1.0 = old default
const POPS   = [40, 60, 80, 100, 120, 140];           // harvesters, capped at 140

const runs = [];
for (const pop of POPS)
  for (const c of CHANCE)
    runs.push({ id: `selective_pop${pop}_c${String(Math.round(c * 100)).padStart(3, '0')}`,
                config: { ...ANCHOR, humanAddRate: pop, plantSelectionChance: c } });

fs.writeFileSync(path.join(HERE, 'cross-selective.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} runs: selective% {${CHANCE.join(', ')}} × pop {${POPS.join(', ')}} @ energy 20, saved 0.20, all-plant`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
