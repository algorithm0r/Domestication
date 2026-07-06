// gen-volatility.mjs — build replicate runs at representative cells to measure
// run-to-run variation (R1.4). Each replicate is the SAME config with a unique id;
// the runner uses unseeded Math.random, so replicates differ by RNG draw alone.
// POSTs the batch to the live coordinator's /enqueue (start coordinator first).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const BASE = { epoch: 150000, humansAdded: 25000, plantingTime: 50000,
  harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0 };

// cell -> replicate count. cells chosen to span the regimes seen in the map:
const CELLS = [
  { pop: 100, pl: 80,  reps: 20, note: 'boundary (steep gradient — where σ matters most)' },
  { pop: 120, pl: 110, reps: 16, note: 'boundary 2' },
  { pop: 60,  pl: 40,  reps: 16, note: 'peak domesticated (dome~0.43)' },
  { pop: 200, pl: 0,   reps: 16, note: 'deep wild (high predation)' },
];

const runs = [];
for (const c of CELLS)
  for (let r = 1; r <= c.reps; r++)
    runs.push({ id: `vol_pop${c.pop}_pl${c.pl}_r${String(r).padStart(2, '0')}`,
                config: { ...BASE, humanAddRate: c.pop, numPlanters: c.pl } });

fs.writeFileSync(path.join(HERE, 'volatility.json'), JSON.stringify(runs, null, 1));
console.log(`built ${runs.length} volatility runs across ${CELLS.length} cells:`);
for (const c of CELLS) console.log(`  pop${c.pop}_pl${c.pl} ×${c.reps}  — ${c.note}`);

const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
