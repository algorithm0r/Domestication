// div-figs.mjs [collection] — render LINEAGE-DIVERGENCE heatmaps that mirror the dome sweep figs.
// For each sweep cell, divergence = TV distance between the planted and harvested gsp (lineage-age)
// distributions, pooled over reps and the last third of periods. TV in [0,1]: 0 = humans sow and
// pluck the same lineage-age mix (no selection), →1 = they sow a completely different lineage than
// they pluck (strong cultivation selection). TV compares bucket MASS, so the gsp=9999/bucket-19
// saturation can't skew it (unlike a mean). No baseline correction: TV≈0 where planting isn't
// selective. Writes data/<collection>/fig_*_div.svg (pairs with fig_*.svg). Cells mirror mongo-figs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
fs.mkdirSync(DIR, { recursive: true });

const key = p => `${p.humanAddRate}|${p.numPlanters}|${p.metabolicThreshold}|${p.plantSelectionStrength}|${p.plantSelectionChance}|${p.harvestStrategy}|${p.plantStrategy}`;
const POPS = []; for (let p = 10; p <= 120; p += 10) POPS.push(p);
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
function viridis(t) { const s = [[68,1,84],[59,82,139],[33,144,141],[93,201,99],[253,231,37]];
  t = Math.max(0, Math.min(1, t)); const x = t * (s.length - 1), i = Math.floor(x), f = x - i, a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  return [lerp(a[0],b[0],f), lerp(a[1],b[1],f), lerp(a[2],b[2],f)]; }

// pooled last-third NORMALIZED gsp distribution for a field, summed over reps (or null if empty)
function pooledDist(docs, field) {
  const out = new Array(20).fill(0);
  for (const d of docs) { const g = d[field]; if (!Array.isArray(g) || !g.length) continue;
    const t0 = Math.floor(g.length * 2 / 3); for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) out[b] += (g[t][b] || 0); }
  const tot = out.reduce((a, v) => a + v, 0);
  return tot ? out.map(v => v / tot) : null;
}
const tvDist = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);   // total variation, [0,1]

const A = { metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' };
const PL = []; for (let p = 0; p <= 100; p += 10) PL.push(p);
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
const SEL = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const EN = [10, 20, 30, 40, 50];
const EN_POPS = []; for (let p = 10; p <= 120; p += 10) EN_POPS.push(p);

const SWEEPS = [
  { file: 'fig_pp_div.svg', title: 'Lineage divergence: planting effort × population', sub: 'TV distance, planted vs harvested gsp (0=identical, 1=disjoint)', COLS: PL, colLabel: 'planters', cellParams: (pop, np) => np > pop ? null : ({ ...A, humanAddRate: pop, numPlanters: np }) },
  { file: 'fig_saved_div.svg', title: 'Lineage divergence: saved% × population', sub: 'TV distance, planted vs harvested gsp (0=identical, 1=disjoint)', COLS: SAVED, colLabel: 'saved% (plantSelectionStrength)', cellParams: (pop, s) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionStrength: s }) },
  { file: 'fig_selective_div.svg', title: 'Lineage divergence: selective% × population', sub: 'TV distance, planted vs harvested gsp (0=identical, 1=disjoint)', COLS: SEL, colLabel: 'selective% (plantSelectionChance)', cellParams: (pop, c) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionChance: c }) },
  { file: 'fig_energy_div.svg', title: 'Lineage divergence: energy × population', sub: 'TV distance, planted vs harvested gsp (0=identical, 1=disjoint)', COLS: EN, colLabel: 'metabolic energy', cellParams: (pop, mt) => ({ ...A, humanAddRate: pop, numPlanters: pop, metabolicThreshold: mt }), pops: EN_POPS, linearCols: true },
];

function render(sw, dval) {
  const pops = sw.pops || POPS, COLS = sw.COLS;
  const CW = 50, CH = 30, padL = 70, padT = 64, padR = 80, padB = 50, unitPx = 5;
  const colW = sw.linearCols ? COLS.map((_, i) => (i < COLS.length - 1 ? COLS[i + 1] - COLS[i] : COLS[i] - COLS[i - 1]) * unitPx) : COLS.map(() => CW);
  const colX = []; { let acc = padL; for (const w of colW) { colX.push(acc); acc += w; } }
  const gridW = colW.reduce((a, b) => a + b, 0), W = padL + gridW + padR, H = padT + pops.length * CH + padB;
  const grid = {}; let max = 0, filled = 0;
  for (const pop of pops) for (const v of COLS) {
    const params = sw.cellParams(pop, v); if (!params) continue;
    const D = dval[key(params)]; if (D == null) continue;
    grid[`${pop}_${v}`] = D; filled++; if (D > max) max = D;
  }
  if (max <= 0) max = 0.001;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  s += `<text x="${padL}" y="26" font-size="15" font-weight="700" fill="#111">${sw.title}</text>`;
  s += `<text x="${padL}" y="44" font-size="11" fill="#666">${sw.sub} — max ${max.toFixed(2)}</text>`;
  for (let ri = 0; ri < pops.length; ri++) for (let ci = 0; ci < COLS.length; ci++) {
    const pop = pops[ri], v = COLS[ci], x = colX[ci], y = padT + ri * CH, cw = colW[ci];
    if (!sw.cellParams(pop, v)) { s += `<rect x="${x}" y="${y}" width="${cw}" height="${CH}" fill="#f4f4f4" stroke="#fff" stroke-width="0.5"/>`; continue; }
    const g = grid[`${pop}_${v}`];
    if (g == null) { s += `<rect x="${x}" y="${y}" width="${cw}" height="${CH}" fill="#ddd" stroke="#fff" stroke-width="0.5"/>`; continue; }
    const [r, gn, b] = viridis(Math.max(0, g) / max);
    s += `<rect x="${x}" y="${y}" width="${cw}" height="${CH}" fill="${hex(r,gn,b)}" stroke="#fff" stroke-width="0.5"/>`;
    const lum = 0.299*r + 0.587*gn + 0.114*b; s += `<text x="${x+cw/2}" y="${y+CH/2+3}" font-size="9" text-anchor="middle" fill="${lum>140?'#111':'#fff'}">${g.toFixed(2)}</text>`;
  }
  COLS.forEach((v, ci) => s += `<text x="${colX[ci]+colW[ci]/2}" y="${padT-6}" font-size="10" fill="#555" text-anchor="middle">${typeof v === 'number' && v < 1 && v > 0 ? v.toFixed(2) : v}</text>`);
  pops.forEach((p, ri) => s += `<text x="${padL-8}" y="${padT+ri*CH+CH/2+3}" font-size="10" fill="#555" text-anchor="end">${p}</text>`);
  s += `<text x="${padL+gridW/2}" y="${H-14}" font-size="12" fill="#222" text-anchor="middle">${sw.colLabel} →</text>`;
  s += `<text x="16" y="${padT+pops.length*CH/2}" font-size="12" fill="#222" text-anchor="middle" transform="rotate(-90 16 ${padT+pops.length*CH/2})">population →</text></svg>`;
  fs.writeFileSync(path.join(DIR, sw.file), s);
  return filled;
}

const socket = connect();
socket.on('connect_error', e => { console.log('connect_error', e.message); process.exit(1); });
socket.on('connect', async () => {
  // collect unique cell keys across all sweeps, with the params to query
  const cells = new Map();
  for (const sw of SWEEPS) for (const pop of (sw.pops || POPS)) for (const v of sw.COLS) {
    const p = sw.cellParams(pop, v); if (p) cells.set(key(p), p);
  }
  const dval = {};
  let done = 0;
  for (const [k, p] of cells) {
    const docs = await findAll(socket, COLL, { setting: settingKey({ ...BASE, ...p }) }, { plantedGspData: 1, harvestedGspData: 1 });
    done++;
    if (!docs.length) continue;
    const Pp = pooledDist(docs, 'plantedGspData'), Ph = pooledDist(docs, 'harvestedGspData');
    if (Pp && Ph) dval[k] = tvDist(Pp, Ph);
  }
  const counts = SWEEPS.map(sw => render(sw, dval));
  console.log(`div-figs: queried ${done} cells, ${Object.keys(dval).length} with divergence — pp(${counts[0]}) saved(${counts[1]}) sel(${counts[2]}) energy(${counts[3]})`);
  socket.close(); process.exit(0);
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 180000);
