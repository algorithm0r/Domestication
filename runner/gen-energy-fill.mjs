// gen-energy-fill.mjs — fill every empty cell of the energy×population plot (fig_energy.svg).
// The plot grid is EN_POPS × EN (see mongo-figs.mjs). Each cell needs BOTH:
//   - the all-planting run  (numPlanters = pop)      → the raw domestication value
//   - the no-planting run   (numPlanters = 0)        → the per-(pop,energy) baseline subtracted
// We diff the full grid's settingKeys against everything already ENQUEUED (any status) in the
// live coordinator state, so cells that are already done OR in flight are skipped — only genuine
// gaps get queued. N=5 reps per missing config. DRY=1 previews without enqueuing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPS = 5;
const p2 = v => String(v).padStart(2, '0');

// the plot grid — must match mongo-figs.mjs (EN_POPS, EN)
const EN_POPS = []; for (let p = 10; p <= 200; p += 10) EN_POPS.push(p);
const EN = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

// anchor background (identical to gen-settings.mjs BASE+A for the energy sweep)
const BASE = { epoch: 150000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const A = { harvestStrategy: 'random', plantStrategy: 'bottom', plantSelectionStrength: 0.2, plantSelectionChance: 1 };
const cell = (pop, mt, pl) => ({ ...BASE, ...A, humanAddRate: pop, numPlanters: pl, metabolicThreshold: mt });

// existing settingKeys from the live coordinator state (any status = done/running/pending)
const state = JSON.parse(fs.readFileSync(path.join(HERE, 'production-state.json'), 'utf8'));
const have = new Set(state.map(r => settingKey(r.config)));
console.log(`live state: ${state.length} runs, ${have.size} distinct settingKeys`);

const runs = [];
let gapCells = 0;
for (const pop of EN_POPS) for (const mt of EN) {
  let cellHadGap = false;
  for (const pl of [pop, 0]) {                              // all-planting cell + its no-planting baseline
    const config = cell(pop, mt, pl);
    if (have.has(settingKey(config))) continue;            // already covered (done or in flight)
    cellHadGap = true;
    for (let r = 1; r <= REPS; r++) runs.push({ id: `egrid_pop${pop}_mt${p2(mt)}_pl${pl}_r${p2(r)}`, config });
  }
  if (cellHadGap) gapCells++;
}

console.log(`grid ${EN_POPS.length}×${EN.length} = ${EN_POPS.length * EN.length} cells; ${gapCells} cells with a gap`);
console.log(`-> ${runs.length} runs to enqueue (${REPS} reps × missing configs)`);

if (process.env.DRY) {
  fs.writeFileSync(path.join(HERE, 'energy-fill.json'), JSON.stringify(runs, null, 1));
  console.log('DRY run — wrote energy-fill.json, NOT enqueued');
} else {
  fs.writeFileSync(path.join(HERE, 'energy-fill.json'), JSON.stringify(runs, null, 1));
  const COORD = process.env.COORD ?? 'http://localhost:8088';
  const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
  console.log('enqueue ->', JSON.stringify(await res.json()));
}
