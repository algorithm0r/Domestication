// _gspcollapse.mjs — the collapse under a SECOND lens: dome vs signed mean-gsp gap (harvested - planted),
// computed over the exact same cells as collapse-fig, so we can compare it head-to-head with the TV collapse.
// TV is a symmetric distributional distance (saturates); Δmean is directional and in units of generations of
// lineage separation (does not saturate). Prints pooled/per-sweep r for BOTH metrics and writes a JSON to plot.
// Reps capped at 4/cell (means are stable) to keep the gsp pull fast.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { connect, find, settingKey } from './mongo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
const agg = JSON.parse(fs.readFileSync(path.join(DIR, 'aggregate.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const byId = {}; for (const s of settings) byId[s.id] = s;
const key = p => `${p.humanAddRate}|${p.numPlanters}|${p.metabolicThreshold}|${p.plantSelectionStrength}|${p.plantSelectionChance}|${p.harvestStrategy}|${p.plantStrategy}`;
const dome = {}; for (const s of agg) dome[key(s.params)] = s.conflatedMean;
const nBySetting = {}; for (const s of agg) nBySetting[s.setting] = s.n;
// reuse gen-megafig-data's cache: it already pulled tv+gap for every swept cell (gap === our delta), so if it
// ran first (regen-paper orders it before us) we skip re-pulling ~700 cells and only pull the discrete anchors.
let mcache = {}; try { mcache = JSON.parse(fs.readFileSync(path.join(DIR, 'megafig-cache.json'), 'utf8')); } catch {}
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const A = { metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' };
const POPS = []; for (let p = 10; p <= 160; p += 10) POPS.push(p);
const PL = []; for (let p = 0; p <= 160; p += 10) PL.push(p);
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00], SEL = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], EN = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const noPlantBase = pop => dome[key({ ...A, humanAddRate: pop, numPlanters: 0 })];
const SWEEPS = [
  { name: 'planters', pops: POPS, COLS: PL, cp: (pop, np) => np > pop ? null : ({ ...A, humanAddRate: pop, numPlanters: np }), base: (pop) => noPlantBase(pop) },
  { name: 'saved%', pops: POPS, COLS: SAVED, cp: (pop, s) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionStrength: s }), base: (pop) => noPlantBase(pop) },
  { name: 'selective%', pops: POPS, COLS: SEL, cp: (pop, c) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionChance: c }), base: (pop) => noPlantBase(pop) },
  { name: 'energy', pops: POPS, COLS: EN, cp: (pop, mt) => ({ ...A, humanAddRate: pop, numPlanters: pop, metabolicThreshold: mt }), base: (pop, mt) => dome[key({ ...A, humanAddRate: pop, numPlanters: 0, metabolicThreshold: mt })] },
];
function dist(docs, f) { const o = new Array(20).fill(0); for (const d of docs) { const g = d[f]; if (!Array.isArray(g) || !g.length) continue; const t0 = Math.floor(g.length * 2 / 3); for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) o[b] += (g[t][b] || 0); } const tot = o.reduce((a, v) => a + v, 0); return tot ? o.map(v => v / tot) : null; }
const tv = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);
const meanBin = D => D ? D.reduce((a, v, b) => a + b * v, 0) : null;
function pearson(xs, ys) { const n = xs.length; if (n < 3) return NaN; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } return sxy / Math.sqrt(sxx * syy); }
function rank(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++; const avg = (i + j - 1) / 2 + 1; for (let k = i; k < j; k++) r[idx[k][1]] = avg; i = j; } return r; }
const spearman = (xs, ys) => pearson(rank(xs), rank(ys));

const socket = connect();
let connected = false;
socket.on('connect_error', () => { if (!connected) process.exit(1); });
socket.on('connect', async () => {
  if (connected) return; connected = true;
  const PROJ = { plantedGspData: 1, harvestedGspData: 1 };
  const gspOf = async (sk) => { const docs = await find(socket, COLL, { setting: sk }, PROJ, 4, 0, 60000); if (!docs || !docs.length) return null;
    const P = dist(docs, 'plantedGspData'), H = dist(docs, 'harvestedGspData'); if (!P || !H) return null;
    return { tv: tv(P, H), delta: meanBin(H) - meanBin(P) }; };

  const cells = new Map();
  for (const sw of SWEEPS) for (const pop of sw.pops) for (const v of sw.COLS) { const p = sw.cp(pop, v); if (p && p.numPlanters > 0) cells.set(key(p), p); }
  const metric = {}; let i = 0, pulls = 0, reused = 0;
  for (const [k, p] of cells) {
    const sk = settingKey({ ...BASE, ...p });
    const c = mcache[sk];
    if (c && c.n === (nBySetting[sk] || 0) && c.tv != null && c.gap != null) { metric[k] = { tv: c.tv, delta: c.gap }; reused++; }
    else { const g = await gspOf(sk); pulls++; if (g) metric[k] = g; }
    if (++i % 40 === 0) process.stderr.write(`${i}/${cells.size} (${pulls} pulls, ${reused} cached)\n`);
  }

  const pts = [];
  for (const sw of SWEEPS) for (const pop of sw.pops) for (const v of sw.COLS) { const p = sw.cp(pop, v); if (!p) continue; const k = key(p);
    const dR = dome[k], b = sw.base(pop, v), m = metric[k]; if (dR == null || b == null || !m) continue;
    if (!pts.find(q => q.k === k)) pts.push({ k, tv: m.tv, delta: m.delta, dome: dR - b, sweep: sw.name }); }

  // anchors (plant + gsp)
  const ANCHOR_PLANT = ['p12_plant_maxRoots', 'p13_plant_maxFecundity', 'p14_plant_maxWeight', 'p15_plant_maxDispersal', 'p16_plant_minRoots', 'p17_plant_minFecundity', 'p18_plant_minWeight', 'p19_plant_minDispersal', 'p20_plant_bottom', 'p21_plant_top'];
  const ANCHOR_GSP = [['lin_mingsp_pop80', 'youngest'], ['lin_maxgsp_pop80', 'oldest']];
  const base80 = noPlantBase(80), anchors = [];
  for (const [id, kind] of [...ANCHOR_PLANT.map(id => [id, 'plant']), ...ANCHOR_GSP.map(([id, l]) => [id, 'gsp:' + l])]) {
    const cfg = byId[id]; if (!cfg) continue; const g = await gspOf(settingKey(cfg.config)); const dR = dome[key(cfg.config)];
    if (g && dR != null) anchors.push({ id, kind, tv: g.tv, delta: g.delta, dome: dR - base80 });
  }

  const allTV = pts.map(p => p.tv), allDe = pts.map(p => p.delta), allD = pts.map(p => p.dome);
  console.log(`\n=== ${pts.length} sweep cells + ${anchors.length} anchors ===`);
  console.log(`TV    lens : pooled pearson ${pearson(allTV, allD).toFixed(3)}  spearman ${spearman(allTV, allD).toFixed(3)}`);
  console.log(`Δmean lens : pooled pearson ${pearson(allDe, allD).toFixed(3)}  spearman ${spearman(allDe, allD).toFixed(3)}`);
  console.log('per-sweep (pearson TV | Δmean):');
  for (const sw of SWEEPS) { const sp = pts.filter(p => p.sweep === sw.name); if (sp.length < 3) continue;
    console.log(`  ${sw.name.padEnd(11)} n=${String(sp.length).padStart(3)}  TV ${pearson(sp.map(p => p.tv), sp.map(p => p.dome)).toFixed(2)}   Δmean ${pearson(sp.map(p => p.delta), sp.map(p => p.dome)).toFixed(2)}`); }
  const ax = anchors.map(a => a.delta), ay = anchors.map(a => a.dome), atv = anchors.map(a => a.tv);
  console.log(`anchors (n=${anchors.length}): TV ${pearson(atv, ay).toFixed(3)}   Δmean ${pearson(ax, ay).toFixed(3)}`);
  fs.writeFileSync(path.join(DIR, 'gspcollapse-data.json'), JSON.stringify({ points: pts.map(({ k, ...r }) => r), anchors }));
  console.log(`wrote gspcollapse-data.json (${reused} cells reused from megafig cache, ${pulls} pulled + ${anchors.length} anchors)`);
  socket.close(); process.exit(0);
});
setTimeout(() => { console.log('watchdog timeout'); process.exit(1); }, 1200000);
