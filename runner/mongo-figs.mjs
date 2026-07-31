// mongo-figs.mjs [collection] — render the corrected sweep heatmaps from the Mongo aggregate.
// Reads data/<collection>/aggregate.json (written by pull.mjs); each setting carries its
// params + conflatedMean (mean dome over replicates). Renders 4 SVGs: pop×planters and
// saved%/selective%/energy × pop, each baseline-corrected by the pure-harvester (numPlanters=0)
// cell at the matching population. Writes data/<collection>/fig_*.svg.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);

const aggPath = path.join(DIR, 'aggregate.json');
if (!fs.existsSync(aggPath)) { console.log('no aggregate yet for', COLL); process.exit(0); }
const agg = JSON.parse(fs.readFileSync(aggPath, 'utf8'));
// per-settingKey convergence status written by the coordinator (converged / stalled / active)
let CONV = {}; const convPath = path.join(DIR, 'convergence.json');
if (fs.existsSync(convPath)) { try { CONV = JSON.parse(fs.readFileSync(convPath, 'utf8')); } catch {} }
const statusColor = s => s === 'converged' ? '#2e7d32' : s === 'stalled' ? '#ff0000' : '#3a78c9';

// index settings by their defining params
const dome = {};               // key -> conflatedMean
const key = p => `${p.humanAddRate}|${p.numPlanters}|${p.metabolicThreshold}|${p.plantSelectionStrength}|${p.plantSelectionChance}|${p.harvestStrategy}|${p.plantStrategy}`;
for (const s of agg) dome[key(s.params)] = { v: s.conflatedMean, n: s.n };
const POPS = []; for (let p = 10; p <= 160; p += 10) POPS.push(p);

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
function viridis(t) { const s = [[68,1,84],[59,82,139],[33,144,141],[93,201,99],[253,231,37]];
  t = Math.max(0, Math.min(1, t)); const x = t * (s.length - 1), i = Math.floor(x), f = x - i, a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  return [lerp(a[0],b[0],f), lerp(a[1],b[1],f), lerp(a[2],b[2],f)]; }

// baseline at a pop (energy-20 pure-harvester: numPlanters 0) — used by pp/saved/selective figs
const baseAt = pop => { const d = dome[key({ humanAddRate: pop, numPlanters: 0, metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' })]; return d ? d.v : null; };
// per-(pop,energy) pure-harvester baseline — for correcting the energy×pop fig (needs enbase_* runs)
const baseEnergy = (pop, mt) => { const d = dome[key({ humanAddRate: pop, numPlanters: 0, metabolicThreshold: mt, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' })]; return d ? d.v : null; };

// generic corrected heatmap: rows=pops, cols=values, cell(pop,val)->params.
// opts.pops overrides the row set; opts.baseFn(pop,v) overrides the per-cell baseline.
// When correct and a cell has data but no baseline yet, it's left PENDING (gray) rather than
// shown raw — so a partially-filled correction never mixes corrected and raw cells.
function render(file, title, sub, COLS, colLabel, cellParams, correct = true, opts = {}) {
  const pops = opts.pops || POPS;
  const baseFn = opts.baseFn || (pop => baseAt(pop));
  const CW = 50, CH = 30, padL = 70, padT = 64, padR = 80, padB = 50;
  // column geometry: uniform CW by default; when opts.linearCols each cell's width is the step FROM
  // its value TO the next sample (the last cell reuses the previous step), so the axis is linear in
  // the column value and the physical scale stays constant even where the sampling step changes
  // (e.g. energy 5→10, so step-10 cells render 2× the width of step-5 ones; the 5→10 transition cell,
  // energy 30, is full step-10 width). unitPx = px per column-value unit.
  const unitPx = opts.unitPx ?? 5;
  const colW = opts.linearCols
    ? COLS.map((_, i) => (i < COLS.length - 1 ? COLS[i + 1] - COLS[i] : COLS[i] - COLS[i - 1]) * unitPx)
    : COLS.map(() => CW);
  const colX = []; { let acc = padL; for (const w of colW) { colX.push(acc); acc += w; } }
  const gridW = colW.reduce((a, b) => a + b, 0);
  const W = padL + gridW + padR, H = padT + pops.length * CH + padB;
  const grid = {}; let max = 0, pending = 0;
  for (const pop of pops) for (const v of COLS) {
    const params = cellParams(pop, v); if (!params) continue;        // out of range (e.g. planters>pop)
    const cell = dome[key(params)]; if (!cell || cell.v == null) continue;
    let val = cell.v;
    if (correct) { const b = baseFn(pop, v); if (b == null) { grid[`${pop}_${v}`] = { pending: true }; pending++; continue; } val = cell.v - b; }
    grid[`${pop}_${v}`] = { val, n: cell.n }; if (val > max) max = val;
  }
  if (max <= 0) max = 0.001;
  const sub2 = correct && pending ? `${sub} — ${pending} cell(s) pending no-planting baselines` : sub;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  s += `<text x="${padL}" y="26" font-size="15" font-weight="700" fill="#111">${title}</text>`;
  s += `<text x="${padL}" y="44" font-size="11" fill="#666">${sub2}</text>`;
  { const lx = W - 250, ly = 22; s += `<g font-size="10" fill="#555">` +   // status legend (corner dot on settled cells; working cells have no dot)
    `<circle cx="${lx}" cy="${ly - 3}" r="3" fill="#2e7d32"/><text x="${lx + 7}" y="${ly}">converged</text>` +
    `<circle cx="${lx + 76}" cy="${ly - 3}" r="3" fill="#ff0000"/><text x="${lx + 83}" y="${ly}">non-conv</text>` +
    `<text x="${lx + 150}" y="${ly}" fill="#999">no dot = working</text></g>`; }
  for (let ri = 0; ri < pops.length; ri++) for (let ci = 0; ci < COLS.length; ci++) {
    const pop = pops[ri], v = COLS[ci], x = colX[ci], y = padT + ri * CH, cw = colW[ci];
    if (!cellParams(pop, v)) { s += `<rect x="${x}" y="${y}" width="${cw}" height="${CH}" fill="#f4f4f4" stroke="#fff" stroke-width="0.5"/>`; continue; }   // out of range
    const g = grid[`${pop}_${v}`];
    if (g && g.pending) { s += `<rect x="${x}" y="${y}" width="${cw}" height="${CH}" fill="#e6e2d6" stroke="#fff" stroke-width="0.5"/><text x="${x+cw/2}" y="${y+CH/2+3}" font-size="8" text-anchor="middle" fill="#998">…</text>`; continue; }
    const [r, gn, b] = g ? viridis(Math.max(0, g.val) / max) : [221, 221, 221];
    s += `<rect x="${x}" y="${y}" width="${cw}" height="${CH}" fill="${hex(r,gn,b)}" stroke="#fff" stroke-width="0.5"/>`;
    if (g) { const lum = 0.299*r + 0.587*gn + 0.114*b; s += `<text x="${x+cw/2}" y="${y+CH/2+3}" font-size="9" text-anchor="middle" fill="${lum>140?'#111':'#fff'}">${g.val.toFixed(2)}</text>`; }
    const st = CONV[settingKey({ ...BASE, ...cellParams(pop, v) })];   // corner dot only for SETTLED cells (green=converged, amber=non-converged); working cells get no dot
    if (st && st.status !== 'active') s += `<circle cx="${(x + cw - 4).toFixed(1)}" cy="${y + 4}" r="2.6" fill="${statusColor(st.status)}" stroke="#fff" stroke-width="0.7"/>`;
  }
  COLS.forEach((v, ci) => s += `<text x="${colX[ci]+colW[ci]/2}" y="${padT-6}" font-size="10" fill="#555" text-anchor="middle">${typeof v === 'number' && v < 1 && v > 0 ? v.toFixed(2) : v}</text>`);
  pops.forEach((p, ri) => s += `<text x="${padL-8}" y="${padT+ri*CH+CH/2+3}" font-size="10" fill="#555" text-anchor="end">${p}</text>`);
  s += `<text x="${padL+gridW/2}" y="${H-14}" font-size="12" fill="#222" text-anchor="middle">${colLabel} →</text>`;
  s += `<text x="16" y="${padT+pops.length*CH/2}" font-size="12" fill="#222" text-anchor="middle" transform="rotate(-90 16 ${padT+pops.length*CH/2})">population →</text>`;
  s += `</svg>`;
  fs.writeFileSync(path.join(DIR, file), s);
  return Object.keys(grid).length;
}

const A = { metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' };   // anchor energy is now 20
const PL = []; for (let p = 0; p <= 160; p += 10) PL.push(p);   // planters axis mirrors population (np capped at pop)
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
const SEL = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const EN = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

fs.mkdirSync(DIR, { recursive: true });
const c1 = render('fig_pp.svg', 'Domestication: planting effort × population (corrected)', 'dome − pure-harvester baseline; energy 20',
  PL, 'planters', (pop, np) => np > pop ? null : ({ ...A, humanAddRate: pop, numPlanters: np }));
const c2 = render('fig_saved.svg', 'saved% × population (corrected)', 'all-planting, energy 20, selective 1.0',
  SAVED, 'saved% (plantSelectionStrength)', (pop, s) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionStrength: s }));
const c3 = render('fig_selective.svg', 'selective% × population (corrected)', 'all-planting, energy 20, saved 0.20',
  SEL, 'selective% (plantSelectionChance)', (pop, c) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionChance: c }));
// energy×pop: corrected per-(pop,energy) no-planting baseline (enbase_*). Full every-10 pop range
// 10–140, each row per-cell baseline-corrected — the low-pop rows correct toward ~0, confirming
// they're WT1 artifact rather than planting-induced (instead of dropping them). Cells without a
// baseline yet render as pending (…) until the enbase_* runs land.
const EN_POPS = []; for (let p = 10; p <= 160; p += 10) EN_POPS.push(p);
const c4 = render('fig_energy.svg', 'energy × population (corrected)', 'all-planting, saved 0.20, selective 1.0; baseline = per-(pop,energy) no-planting',
  EN, 'metabolic energy', (pop, mt) => ({ ...A, humanAddRate: pop, numPlanters: pop, metabolicThreshold: mt }), true,
  { pops: EN_POPS, baseFn: (pop, mt) => baseEnergy(pop, mt), linearCols: true });
console.log(`rendered sweep figs from ${agg.length} settings: pp(${c1}) saved(${c2}) sel(${c3}) energy(${c4}) cells filled`);
