// pexp-grid.mjs [collection] — the discrete p-experiment / gsp summary grid: a 4x6 matrix of
// domestication (mean dome) and lineage divergence (TV between planted & harvested gsp), one cell per
// named experiment, matching the sweep-heatmap style. Rows = harvest max/min, plant max/min. Cols = the
// four genes, then position (bottom/top) and lineage-age (fresh/old) gsp — which exist only for planting,
// so the two harvest rows are blank there. Writes data/<coll>/pexp-grid.json for heat_pexp.py.
// Dome reported RAW (as in the paper's per-experiment distributions); WT III (random plant) baseline is
// ~0.035 at this pop-80 anchor, so corrected = raw-0.035 is included in the JSON but not the default render.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const byId = {}; for (const s of settings) byId[s.id] = s;

const ROWS = ['harvest max', 'harvest min', 'plant max', 'plant min'];
const COLS = ['Root Depth', 'Fecundity', 'Seed Dispersal', 'Abscission',
  'position\n(max=top, min=bottom)', 'lineage age\n(max=old, min=fresh)'];
// grid[row][col] = experiment id (null = no such experiment)
const GRID = [
  ['p04_harv_maxRoots', 'p05_harv_maxFecundity', 'p06_harv_maxWeight', 'p07_harv_maxDispersal', null, null],
  ['p08_harv_minRoots', 'p09_harv_minFecundity', 'p10_harv_minWeight', 'p11_harv_minDispersal', null, null],
  ['p12_plant_maxRoots', 'p13_plant_maxFecundity', 'p14_plant_maxWeight', 'p15_plant_maxDispersal', 'p21_plant_top', 'lin_maxgsp_pop80'],
  ['p16_plant_minRoots', 'p17_plant_minFecundity', 'p18_plant_minWeight', 'p19_plant_minDispersal', 'p20_plant_bottom', 'lin_mingsp_pop80'],
];
const BASELINE_ID = 'p03_wt3_plantrandom';   // WT III random-plant reference for the corrected dome
// Directional-harvest artifact: selectively harvesting the shattering gene strips shattering seeds and
// drives dome to ~1 WITHOUT any lineage isolation (its divergence is ~baseline). Flagged red and left out
// of the dome color scale so the one artifact doesn't wash out the contrast among the real experiments.
const FLAG_IDS = ['p07_harv_maxDispersal'];

const PROJ = { dome: 1, plantedGspData: 1, harvestedGspData: 1 };
function dist(docs, f) { const o = new Array(20).fill(0); for (const d of docs) { const g = d[f]; if (!Array.isArray(g) || !g.length) continue; const t0 = Math.floor(g.length * 2 / 3); for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) o[b] += (g[t][b] || 0); } const tot = o.reduce((a, v) => a + v, 0); return tot ? o.map(v => v / tot) : null; }
const tv = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);
const meanBin = D => D ? D.reduce((a, v, b) => a + b * v, 0) : null;   // mean lineage-age in bin units (as _gspcollapse)
const pull = (key) => new Promise(res => { const s = connect(); let done = false; const fin = v => { if (done) return; done = true; try { s.close(); } catch {}; res(v); };
  s.on('connect', async () => { try { const d = await findAll(s, COLL, { setting: key }, PROJ); fin(d); } catch { fin(null); } });
  s.on('connect_error', () => fin(null)); setTimeout(() => fin(done ? undefined : null), 90000); });

async function measure(id) {
  const cfg = byId[id]; if (!cfg) return { id, dome: null, div: null, gap: null, n: 0, missing: true };
  const docs = await pull(settingKey(cfg.config));
  if (!docs) return { id, dome: null, div: null, gap: null, n: 0, fail: true };
  const domes = docs.map(d => d.dome).filter(v => typeof v === 'number');
  const meanDome = domes.length ? domes.reduce((a, b) => a + b, 0) / domes.length : null;
  const Pp = dist(docs, 'plantedGspData'), Ph = dist(docs, 'harvestedGspData');
  const div = (Pp && Ph) ? tv(Pp, Ph) : null;
  const gap = (Pp && Ph) ? meanBin(Ph) - meanBin(Pp) : null;   // signed mean lineage-age gap, harvested - planted
  return { id, dome: meanDome, div, gap, n: docs.length };
}

const base = await measure(BASELINE_ID);
const baseDome = base.dome == null ? 0 : base.dome;
const domeRaw = [], domeCorr = [], div = [], gap = [], meta = [];
for (const row of GRID) {
  const dr = [], dc = [], dv = [], gp = [], mr = [];
  for (const id of row) {
    if (id == null) { dr.push(null); dc.push(null); dv.push(null); gp.push(null); mr.push(null); process.stderr.write(' '); continue; }
    const r = await measure(id);
    dr.push(r.dome == null ? null : +r.dome.toFixed(3));
    dc.push(r.dome == null ? null : +(r.dome - baseDome).toFixed(3));   // corrected, unclamped (as the collapse plot)
    dv.push(r.div == null ? null : +r.div.toFixed(3));
    gp.push(r.gap == null ? null : +r.gap.toFixed(3));
    mr.push({ id, n: r.n });
    process.stderr.write('.');
  }
  domeRaw.push(dr); domeCorr.push(dc); div.push(dv); gap.push(gp); meta.push(mr);
}
process.stderr.write('\n');

const flags = [];   // [row, col] cells drawn red + excluded from the dome color scale
GRID.forEach((row, i) => row.forEach((id, j) => { if (id && FLAG_IDS.includes(id)) flags.push([i, j]); }));
const out = {
  rows: ROWS, cols: COLS, rowLabel: 'selection', colLabel: 'gene / mechanism',
  baseline: { id: BASELINE_ID, dome: +baseDome.toFixed(3), div: base.div == null ? null : +base.div.toFixed(3), gap: base.gap == null ? null : +base.gap.toFixed(3) },
  dome: domeRaw, domeCorrected: domeCorr, div, gap, meta, flags,
};
fs.writeFileSync(path.join(DIR, 'pexp-grid.json'), JSON.stringify(out, null, 1));

// console table
console.log('\nWT III baseline (random plant): dome', out.baseline.dome, 'div', out.baseline.div, '\n');
console.log('DOME (raw)'.padEnd(16), COLS.map(c => c.split('\n')[0].slice(0, 8).padStart(9)).join(''));
domeRaw.forEach((r, i) => console.log(ROWS[i].padEnd(16), r.map(v => (v == null ? '-' : v.toFixed(2)).padStart(9)).join('')));
console.log('\nDIVERGENCE (TV)'.padEnd(16), COLS.map(c => c.split('\n')[0].slice(0, 8).padStart(9)).join(''));
div.forEach((r, i) => console.log(ROWS[i].padEnd(16), r.map(v => (v == null ? '-' : v.toFixed(2)).padStart(9)).join('')));
console.log('\nMEAN-GAP (H-P)'.padEnd(16), COLS.map(c => c.split('\n')[0].slice(0, 8).padStart(9)).join(''));
gap.forEach((r, i) => console.log(ROWS[i].padEnd(16), r.map(v => (v == null ? '-' : v.toFixed(2)).padStart(9)).join('')));
process.exit(0);
