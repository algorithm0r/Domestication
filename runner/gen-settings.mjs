// gen-settings.mjs — the production setting matrix for domestication-final-2026.
// Emits settings.json = [{ id, config }], fully-specified and deduped by setting key
// (numPlanters normalized to <= pop, so the all-planting cells shared across sweeps
// collapse to one setting instead of running 4x). Replicates are added by adaptive.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
// sweep anchors (the values held fixed when sweeping another knob) — NEW anchor: pop80 / energy20
const A = { harvestStrategy: 'random', plantStrategy: 'bottom', metabolicThreshold: 20,
            plantSelectionStrength: 0.20, plantSelectionChance: 1.0 };
const POPS      = []; for (let p = 10; p <= 120; p += 10) POPS.push(p);   // 12 (110/120 added; 130/140 pending)
const SAVED     = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];                              // 6
const SELECTIVE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];           // 11
const ENERGY    = [10, 20, 30, 40, 50];                                             // 5
const p3 = v => String(Math.round(v * 1000)).padStart(4, '0');   // 0.025 -> 0025
const p2 = v => String(v).padStart(2, '0');

const settings = [];
const seen = new Map();                                   // settingKey -> id (dedupe)
function add(id, cfg) {
  const full = { ...BASE, harvestStrategy: 'none', plantStrategy: 'none', humanAddRate: 0,
    numPlanters: 0, metabolicThreshold: 30, plantSelectionStrength: 0.2, plantSelectionChance: 1.0, ...cfg };
  full.numPlanters = Math.min(full.numPlanters, full.humanAddRate);   // cap: all-plant == numPlanters=pop
  const key = settingKey(full);
  if (seen.has(key)) return; seen.set(key, id);
  settings.push({ id, config: full });
}
const ALL = 1e9;   // "all humans plant" sentinel (gets capped to pop)

// ---- 1) the 21 original paper experiments. Submitted version was pop 100 / energy 30;
//        the rewrite standardizes ALL experiments on the pop-80 / energy-15 anchor. ----
const paper = [
  ['p01_nohumans',          { harvestStrategy: 'none',  plantStrategy: 'none',   humanAddRate: 0,   plantSelectionChance: 0 }],
  ['p02_wt2_predation',     { harvestStrategy: 'random', plantStrategy: 'none',  humanAddRate: 80, plantSelectionChance: 0 }],
  ['p03_wt3_plantrandom',   { harvestStrategy: 'random', plantStrategy: 'random', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 0 }],
];
const genes = [['Roots', 'deepRoots'], ['Fecundity', 'fecundity'], ['Weight', 'weight'], ['Dispersal', 'dispersal']];
let n = 4;
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_harv_max${lbl}`, { harvestStrategy: g, plantStrategy: 'random', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 0 }]);
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_harv_min${lbl}`, { harvestStrategy: 'min' + g, plantStrategy: 'random', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 0 }]);
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_plant_max${lbl}`, { harvestStrategy: 'random', plantStrategy: g, humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
for (const [lbl, g] of genes) paper.push([`p${p2(n++)}_plant_min${lbl}`, { harvestStrategy: 'random', plantStrategy: 'min' + g, humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
paper.push([`p20_plant_bottom`, { harvestStrategy: 'random', plantStrategy: 'bottom', humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
paper.push([`p21_plant_top`,    { harvestStrategy: 'random', plantStrategy: 'top',    humanAddRate: 80, numPlanters: ALL, plantSelectionChance: 1 }]);
for (const [id, c] of paper) add(id, { metabolicThreshold: 20, ...c });   // paper experiments at the energy-20 anchor
const nPaper = settings.length;

// ---- 2) pop x planters phase diagram (energy 15 anchor) ----
for (const pop of POPS) for (let np = 0; np <= pop; np += 10) add(`pp_pop${pop}_pl${np}`, { ...A, humanAddRate: pop, numPlanters: np });
// ---- 3) saved% x pop ----
for (const pop of POPS) for (const s of SAVED) add(`saved_pop${pop}_s${p3(s)}`, { ...A, humanAddRate: pop, numPlanters: ALL, plantSelectionStrength: s });
// ---- 4) selective% x pop ----
for (const pop of POPS) for (const c of SELECTIVE) add(`sel_pop${pop}_c${p3(c)}`, { ...A, humanAddRate: pop, numPlanters: ALL, plantSelectionChance: c });
// ---- 5) energy x pop ----
for (const pop of POPS) for (const mt of ENERGY) add(`en_pop${pop}_mt${p2(mt)}`, { ...A, humanAddRate: pop, numPlanters: ALL, metabolicThreshold: mt });
// ---- 6) lineage experiment: replant ONLY previously-planted ("planted") vs ONLY natural ("natural") grain ----
// Direct mechanism test of the paper's hypothesis that re-sowing within the planted line drives
// domestication. Baseline (plantLineage "off") = the all-planting anchor cell already present at each pop.
// Lineage experiment via the gens-since-planted counter (gsp: 0 when sown, +1/generation,
// inherited through dispersal). The ONLY selection is the counter. mingsp plants the
// recently-planted lineage (lowest gsp); 'gsp' (=max) plants the deep-wild lineage (highest gsp,
// negative control). Both share the anchor background and differ from the bottom anchor (p20) only
// in plantStrategy; the random baseline is p03 (WT3). Confirmed full-150k: mingsp domesticates
// ~0.52 (low-gsp seeds are non-shattering, ~0.18); the binary-flag design (retired) gave a null.
const LIN = { harvestStrategy: 'random', humanAddRate: 80, numPlanters: ALL,
              metabolicThreshold: 20, plantSelectionStrength: 0.20, plantSelectionChance: 1 };
add('lin_mingsp_pop80', { ...LIN, plantStrategy: 'mingsp' });   // select lowest gsp (recently-planted lineage)
add('lin_maxgsp_pop80', { ...LIN, plantStrategy: 'gsp'    });   // select highest gsp (deep-wild lineage) — negative control

fs.writeFileSync(path.join(HERE, 'settings.json'), JSON.stringify(settings, null, 1));
console.log(`wrote settings.json: ${settings.length} distinct settings`);
console.log(`  paper experiments: ${nPaper}`);
console.log(`  pop×planters:      ${settings.filter(s => s.id.startsWith('pp_')).length}`);
console.log(`  saved%×pop:        ${settings.filter(s => s.id.startsWith('saved_')).length}`);
console.log(`  selective%×pop:    ${settings.filter(s => s.id.startsWith('sel_')).length}`);
console.log(`  energy×pop:        ${settings.filter(s => s.id.startsWith('en_')).length}`);
console.log(`  lineage arms:      ${settings.filter(s => s.id.startsWith('lin_')).length}  (mingsp/maxgsp counter-selection; vs bottom anchor p20, random baseline p03)`);
console.log(`  (overlapping anchor cells deduped via numPlanters normalization)`);
