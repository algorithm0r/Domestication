// gen-rerun15.mjs — final pop×planters phase diagram at the locked anchors:
// energy(metabolicThreshold) 15, saved 0.20, selective 1.0, bottom-of-basket.
// pop 10-140 by 10 (capped at the predation ceiling), planters 0-pop by 10.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ANCHOR = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
  metabolicThreshold: 15, plantSelectionStrength: 0.20, plantSelectionChance: 1.0 };

const exists = id => fs.existsSync(path.join(HERE, 'results', id + '.json'));
const runs = [];
let skip = 0;
for (let pop = 10; pop <= 140; pop += 10)
  for (let np = 0; np <= pop; np += 10) {
    const id = `e15_pop${pop}_pl${np}`;
    if (exists(id)) { skip++; continue; }                 // keep finished cells (idempotent re-run)
    runs.push({ id, config: { ...ANCHOR, humanAddRate: pop, numPlanters: np } });
  }

fs.writeFileSync(path.join(HERE, 'rerun15.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} runs (skipped ${skip} already done): pop×planters @ energy 15, pop 10-140 × planters 0-pop (step 10)`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
