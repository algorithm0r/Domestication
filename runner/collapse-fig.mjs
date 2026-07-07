// collapse-fig.mjs [collection] — THE collapse scatter: every sweep cell is one point,
// x = TV lineage divergence (planted vs harvested gsp), y = corrected dome, colored by sweep.
// Overlays the binned-mean curve and annotates the pooled correlation. Tests whether all four
// sweeps fall on one divergence→domestication curve. Writes data/<collection>/fig_collapse.svg.
// Cell/baseline defs mirror mongo-figs.mjs / div-figs.mjs — keep in sync.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
const aggPath = path.join(DIR, 'aggregate.json');
if (!fs.existsSync(aggPath)) { console.log('no aggregate yet'); process.exit(0); }
const agg = JSON.parse(fs.readFileSync(aggPath, 'utf8'));
const key = p => `${p.humanAddRate}|${p.numPlanters}|${p.metabolicThreshold}|${p.plantSelectionStrength}|${p.plantSelectionChance}|${p.harvestStrategy}|${p.plantStrategy}`;
const dome = {}; for (const s of agg) dome[key(s.params)] = s.conflatedMean;
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const A = { metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' };
const POPS = []; for (let p = 10; p <= 120; p += 10) POPS.push(p);
const PL = []; for (let p = 0; p <= 100; p += 10) PL.push(p);
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30], SEL = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], EN = [10, 20, 30, 40, 50];
const noPlantBase = pop => dome[key({ ...A, humanAddRate: pop, numPlanters: 0 })];
const SWEEPS = [
  { name: 'planters', color: '#e6550d', pops: POPS, COLS: PL, cp: (pop, np) => np > pop ? null : ({ ...A, humanAddRate: pop, numPlanters: np }), base: (pop) => noPlantBase(pop) },
  { name: 'saved%', color: '#31a354', pops: POPS, COLS: SAVED, cp: (pop, s) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionStrength: s }), base: (pop) => noPlantBase(pop) },
  { name: 'selective%', color: '#3182bd', pops: POPS, COLS: SEL, cp: (pop, c) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionChance: c }), base: (pop) => noPlantBase(pop) },
  { name: 'energy', color: '#9e5fbf', pops: POPS, COLS: EN, cp: (pop, mt) => ({ ...A, humanAddRate: pop, numPlanters: pop, metabolicThreshold: mt }), base: (pop, mt) => dome[key({ ...A, humanAddRate: pop, numPlanters: 0, metabolicThreshold: mt })] },
];
function dist(docs, f) { const o = new Array(20).fill(0); for (const d of docs) { const g = d[f]; if (!Array.isArray(g) || !g.length) continue; const t0 = Math.floor(g.length * 2 / 3); for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) o[b] += (g[t][b] || 0); } const tot = o.reduce((a, v) => a + v, 0); return tot ? o.map(v => v / tot) : null; }
const tv = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);
function pearson(xs, ys) { const n = xs.length; if (n < 3) return NaN; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } return sxy / Math.sqrt(sxx * syy); }
function rank(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++; const avg = (i + j - 1) / 2 + 1; for (let k = i; k < j; k++) r[idx[k][1]] = avg; i = j; } return r; }
const spearman = (xs, ys) => pearson(rank(xs), rank(ys));

const socket = connect();
socket.on('connect_error', e => { console.log('connect_error', e.message); process.exit(1); });
socket.on('connect', async () => {
  // unique cells -> TV (one query each)
  const cells = new Map();
  for (const sw of SWEEPS) for (const pop of sw.pops) for (const v of sw.COLS) { const p = sw.cp(pop, v); if (p) cells.set(key(p), p); }
  const tvByKey = {};
  for (const [k, p] of cells) { const docs = await findAll(socket, COLL, { setting: settingKey({ ...BASE, ...p }) }, { plantedGspData: 1, harvestedGspData: 1 }); if (!docs.length) continue; const Pp = dist(docs, 'plantedGspData'), Ph = dist(docs, 'harvestedGspData'); if (Pp && Ph) tvByKey[k] = tv(Pp, Ph); }
  // build points (dedup by cell key; a shared cell keeps its first sweep's color)
  const seen = new Set(), pts = [];
  for (const sw of SWEEPS) for (const pop of sw.pops) for (const v of sw.COLS) {
    const p = sw.cp(pop, v); if (!p) continue; const k = key(p);
    const dR = dome[k], b = sw.base(pop, v), t = tvByKey[k];
    if (dR == null || b == null || t == null) continue;
    if (!seen.has(k)) { seen.add(k); pts.push({ tv: t, dome: dR - b, color: sw.color, sweep: sw.name }); }
  }
  const allTV = pts.map(p => p.tv), allD = pts.map(p => p.dome);
  const rP = pearson(allTV, allD), rS = spearman(allTV, allD);

  // ---- scatter ----
  const W = 780, H = 520, padL = 66, padR = 158, padT = 56, padB = 58, plotW = W - padL - padR, plotH = H - padT - padB;
  const xmax = Math.max(0.1, Math.ceil(Math.max(...allTV, 0.05) * 10) / 10);
  const ymax = Math.max(0.1, Math.ceil(Math.max(...allD, 0.05) * 20) / 20);
  const ymin = Math.min(0, Math.floor(Math.min(...allD, 0) * 20) / 20);
  const X = t => padL + (t / xmax) * plotW, Y = d => padT + plotH - ((d - ymin) / (ymax - ymin)) * plotH;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  s += `<text x="${padL}" y="26" font-size="15" font-weight="700" fill="#111">Domestication vs lineage divergence — collapse across all sweeps</text>`;
  s += `<text x="${padL}" y="43" font-size="11" fill="#666">${pts.length} sweep cells · pooled Pearson ${isNaN(rP) ? '—' : rP.toFixed(3)}, Spearman ${isNaN(rS) ? '—' : rS.toFixed(3)} · each point = one setting (corrected dome vs TV)</text>`;
  // gridlines + ticks
  for (let gx = 0; gx <= xmax + 1e-9; gx += 0.1) { const x = X(gx); s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#eee"/><text x="${x}" y="${padT + plotH + 16}" font-size="10" fill="#666" text-anchor="middle">${gx.toFixed(1)}</text>`; }
  for (let gy = ymin; gy <= ymax + 1e-9; gy += 0.1) { const y = Y(gy); s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#eee"/><text x="${padL - 8}" y="${y + 3}" font-size="10" fill="#666" text-anchor="end">${gy.toFixed(1)}</text>`; }
  s += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#bbb"/>`;
  // points
  for (const p of pts) s += `<circle cx="${X(p.tv).toFixed(1)}" cy="${Y(p.dome).toFixed(1)}" r="3" fill="${p.color}" fill-opacity="0.62"/>`;
  // binned-mean curve (10 bins by TV)
  const sorted = [...pts].sort((a, b) => a.tv - b.tv), nb = 10, per = Math.ceil(sorted.length / nb), line = [];
  for (let i = 0; i < sorted.length; i += per) { const g = sorted.slice(i, i + per); if (!g.length) continue; line.push({ x: g.reduce((a, o) => a + o.tv, 0) / g.length, y: g.reduce((a, o) => a + o.dome, 0) / g.length }); }
  if (line.length > 1) { let d = ''; line.forEach((pt, i) => d += (i ? 'L' : 'M') + X(pt.x).toFixed(1) + ' ' + Y(pt.y).toFixed(1) + ' '); s += `<path d="${d}" fill="none" stroke="#111" stroke-width="2" stroke-opacity="0.7"/>`; for (const pt of line) s += `<circle cx="${X(pt.x).toFixed(1)}" cy="${Y(pt.y).toFixed(1)}" r="3.2" fill="#fff" stroke="#111" stroke-width="1.4"/>`; }
  // axis labels
  s += `<text x="${padL + plotW / 2}" y="${H - 12}" font-size="12" fill="#222" text-anchor="middle">lineage divergence — TV(planted, harvested gsp) →</text>`;
  s += `<text x="18" y="${padT + plotH / 2}" font-size="12" fill="#222" text-anchor="middle" transform="rotate(-90 18 ${padT + plotH / 2})">domestication (corrected dome) →</text>`;
  // legend + per-sweep n
  const counts = {}; for (const p of pts) counts[p.sweep] = (counts[p.sweep] || 0) + 1;
  let ly = padT + 6; s += `<text x="${padL + plotW + 18}" y="${ly}" font-size="11" font-weight="600" fill="#333">sweep</text>`; ly += 18;
  for (const sw of SWEEPS) { s += `<circle cx="${padL + plotW + 24}" cy="${ly - 3}" r="4" fill="${sw.color}"/><text x="${padL + plotW + 34}" y="${ly}" font-size="11" fill="#333">${sw.name} (${counts[sw.name] || 0})</text>`; ly += 18; }
  ly += 6; s += `<circle cx="${padL + plotW + 24}" cy="${ly - 3}" r="3.2" fill="#fff" stroke="#111" stroke-width="1.4"/><text x="${padL + plotW + 34}" y="${ly}" font-size="11" fill="#333">binned mean</text>`;
  s += `</svg>`;
  fs.writeFileSync(path.join(DIR, 'fig_collapse.svg'), s);
  console.log(`collapse-fig: ${pts.length} points, pooled pearson ${rP.toFixed(3)} spearman ${rS.toFixed(3)}`);
  socket.close(); process.exit(0);
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 180000);
