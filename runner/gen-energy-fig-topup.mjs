// gen-energy-fig-topup.mjs — bring the WHOLE fig_energy.svg grid to a flat N=TARGET, BOTH halves
// (all-planting cell + its numPlanters=0 baseline), so the per-(pop,energy) baseline-corrected
// dashboard has uniform precision. Grid + configs are copied verbatim from mongo-figs.mjs.
//
// Counts are taken from the coordinator's ENQUEUED set (production-state.json, any status) — NOT
// just committed Mongo docs — so reps already queued by gen-topup-all (the en_ wave) are counted
// and NOT re-added. Fresh `enfig_` ids for whatever gap remains (mostly the numPlanters=0
// baselines + the pop 150..200 / energy 80..110 extension). Idempotent: coordinator dedups by id.
// SCOPE=core -> pop 10..140 only; SCOPE=full (default) -> pop 10..200.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = parseInt(process.env.TARGET || '10');
const SCOPE = process.env.SCOPE || 'full';
const DRY = process.env.DRY === '1';
const COORD = process.env.COORD || 'http://localhost:8088';
const p2 = v => String(v).padStart(2, '0');

const POP_MAX = SCOPE === 'core' ? 140 : 200;
const EN_POPS = []; for (let p = 10; p <= POP_MAX; p += 10) EN_POPS.push(p);
const EN = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const BG = { epoch: 150000, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom', plantSelectionStrength: 0.2, plantSelectionChance: 1 };

// enqueued count per settingKey, from the live coordinator state (all statuses)
const state = JSON.parse(fs.readFileSync(path.join(HERE, 'production-state.json'), 'utf8'));
const enq = new Map();
for (const r of state) if (r.config) { const k = settingKey(r.config); enq.set(k, (enq.get(k) || 0) + 1); }

const runs = [];
let plantAdd = 0, baseAdd = 0, cellsPlant = 0, cellsBase = 0;
for (const pop of EN_POPS) for (const mt of EN) {
  for (const pl of [pop, 0]) {                       // planting cell + its baseline
    const config = { ...BG, humanAddRate: pop, numPlanters: pl, metabolicThreshold: mt };
    const have = enq.get(settingKey(config)) || 0;   // already ENQUEUED (incl. the en_ wave)
    if (have >= TARGET) continue;
    if (pl === 0) cellsBase++; else cellsPlant++;
    for (let i = have + 1; i <= TARGET; i++) {
      runs.push({ id: `enfig_pop${pop}_mt${p2(mt)}_pl${pl}_r${p2(i)}`, config });
      if (pl === 0) baseAdd++; else plantAdd++;
    }
  }
}

console.log(`scope=${SCOPE} (pop 10..${POP_MAX}), grid ${EN_POPS.length}×${EN.length} per half, target N=${TARGET}`);
console.log(`counting basis: enqueued set (production-state.json, ${state.length} runs) — already-queued reps NOT re-added`);
console.log(`planting cells still short: ${cellsPlant}  (+${plantAdd} reps)`);
console.log(`baseline cells still short: ${cellsBase}  (+${baseAdd} reps)`);
console.log(`TOTAL reps to enqueue: ${runs.length}`);
fs.writeFileSync(path.join(HERE, 'energy-fig-topup.json'), JSON.stringify(runs, null, 0));

if (DRY) { console.log('DRY — nothing enqueued.'); process.exit(0); }
if (!runs.length) { console.log('nothing to enqueue.'); process.exit(0); }
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
