// gen-cross-saved.mjs — first coordinate-ascent cross: saved% × pop.
// Anchor: bottom-of-basket, all humans plant, energy(metabolicThreshold)=20 (current peak),
// selective%(plantSelectionChance)=1.0 (default). We vary plantSelectionStrength (saved%)
// and population (harvesters, capped at 140). Theory: domestication peaks at LOW saved%
// (strong geographic selection) but drops at the very bottom (diff->0, no planting).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ANCHOR = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
  numPlanters: 1e9, metabolicThreshold: 20, plantSelectionChance: 1.0 };  // all plant, energy 20, fully selective

const SAVED = [0.05, 0.10, 0.15, 0.20, 0.30, 0.50];   // plantSelectionStrength; 0.20 = old default
const POPS  = [40, 60, 80, 100, 120, 140];            // harvesters, capped at 140

const runs = [];
for (const pop of POPS)
  for (const s of SAVED)
    runs.push({ id: `saved_pop${pop}_s${String(Math.round(s * 100)).padStart(3, '0')}`,
                config: { ...ANCHOR, humanAddRate: pop, plantSelectionStrength: s } });

fs.writeFileSync(path.join(HERE, 'cross-saved.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} runs: saved% {${SAVED.join(', ')}} × pop {${POPS.join(', ')}} @ energy 20, all-plant`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
