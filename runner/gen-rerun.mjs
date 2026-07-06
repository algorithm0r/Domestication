// gen-rerun.mjs — queue the remaining re-run blocks (paper+wild, planters×pop, saved%×pop,
// selective%×pop, lineage) at the NEW anchor: mt20 / pop80 / epoch 100k / pop 10–100.
// The energy×pop grid is already queued (energy-queue.json); its mt20 baselines and all-plant
// anchor cells are shared, so we DEDUP every config against it and only enqueue what's new.
// Dovetailed, rep-major, N reps. Idempotent (coordinator dedups by id).
//   DRY=1 previews; else POSTs to the coordinator /enqueue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPS = parseInt(process.env.REPS || '3');
const COORD = process.env.COORD || 'http://localhost:8088';
const DRY = process.env.DRY === '1';

const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const A = { harvestStrategy: 'random', plantStrategy: 'bottom', metabolicThreshold: 20,
            plantSelectionStrength: 0.20, plantSelectionChance: 1.0 };   // NEW anchor energy = 20
const POPS = []; for (let p = 10; p <= 100; p += 10) POPS.push(p);
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
const SELECTIVE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const p3 = v => String(Math.round(v * 1000)).padStart(4, '0');
const p2 = v => String(v).padStart(2, '0');
const ALL = 1e9;

const settings = [];
const seen = new Map();
function add(id, cfg) {
  const full = { ...BASE, harvestStrategy: 'none', plantStrategy: 'none', humanAddRate: 0,
    numPlanters: 0, metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1.0, ...cfg };
  full.numPlanters = Math.min(full.numPlanters, full.humanAddRate);
  const key = settingKey(full);
  if (seen.has(key)) return; seen.set(key, id);
  settings.push({ id, config: full, key });
}

// ---- paper experiments (incl. wild types p01/p02/p03), at the mt20 anchor ----
const paper = [
  ['p01_nohumans',        { harvestStrategy: 'none',   plantStrategy: 'none',   humanAddRate: 0,  plantSelectionChance: 0 }],
  ['p02_wt2_predation',   { harvestStrategy: 'random', plantStrategy: 'none',   humanAddRate: 80, plantSelectionChance: 0 }],
  ['p03_wt3_plantrandom', { harvestStrategy: 'random', plantStrategy: 'random', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 0 }],
];
const genes = [['Roots', 'deepRoots'], ['Fecundity', 'fecundity'], ['Weight', 'weight'], ['Dispersal', 'dispersal']];
let n = 4;
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_harv_max${lbl}`, { harvestStrategy: g, plantStrategy: 'random', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 0 }]);
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_harv_min${lbl}`, { harvestStrategy: 'min' + g, plantStrategy: 'random', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 0 }]);
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_plant_max${lbl}`, { harvestStrategy: 'random', plantStrategy: g, humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_plant_min${lbl}`, { harvestStrategy: 'random', plantStrategy: 'min' + g, humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
paper.push([`p20_plant_bottom`, { harvestStrategy: 'random', plantStrategy: 'bottom', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
paper.push([`p21_plant_top`,    { harvestStrategy: 'random', plantStrategy: 'top',    humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
for (const [id, c] of paper) add(id, { metabolicThreshold: 20, ...c });

// ---- planters × pop / saved% × pop / selective% × pop (mt20 anchor) ----
for (const pop of POPS) for (let np = 0; np <= pop; np += 10) add(`pp_pop${pop}_pl${np}`, { ...A, humanAddRate: pop, numPlanters: np });
for (const pop of POPS) for (const s of SAVED)     add(`saved_pop${pop}_s${p3(s)}`, { ...A, humanAddRate: pop, numPlanters: ALL, plantSelectionStrength: s });
for (const pop of POPS) for (const c of SELECTIVE) add(`sel_pop${pop}_c${p3(c)}`,   { ...A, humanAddRate: pop, numPlanters: ALL, plantSelectionChance: c });

// ---- lineage arms (gens-since-planted counter), pop80/mt20 ----
const LIN = { harvestStrategy: 'random', humanAddRate: 80, numPlanters: ALL, metabolicThreshold: 20, plantSelectionStrength: 0.20, plantSelectionChance: 1 };
add('lin_mingsp_pop80', { ...LIN, plantStrategy: 'mingsp' });
add('lin_maxgsp_pop80', { ...LIN, plantStrategy: 'gsp' });

// ---- dedup against the already-queued energy grid ----
const egKeys = new Set(JSON.parse(fs.readFileSync(path.join(HERE, 'energy-queue.json'), 'utf8')).map(r => settingKey(r.config)));
const fresh = settings.filter(s => !egKeys.has(s.key));

const byPrefix = {};
for (const s of fresh) { const pre = (s.id.match(/^[a-z]+/i) || [s.id])[0]; byPrefix[pre] = (byPrefix[pre] || 0) + 1; }
console.log(`built ${settings.length} settings; ${settings.length - fresh.length} already in energy grid; ${fresh.length} new`);
console.log('new settings by prefix:', JSON.stringify(byPrefix));

// ---- dovetail, rep-major ----
const runs = [];
for (let r = 1; r <= REPS; r++) for (const s of fresh) runs.push({ id: `${s.id}_r${p2(r)}`, config: s.config });
console.log(`${runs.length} runs (${fresh.length} settings × ${REPS} reps), dovetailed rep-major`);
fs.writeFileSync(path.join(HERE, 'rerun-queue.json'), JSON.stringify(runs));

if (DRY) { console.log('DRY — not enqueued (wrote rerun-queue.json)'); process.exit(0); }
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
