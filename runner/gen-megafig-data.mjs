// gen-megafig-data.mjs [collection] — data for the mega sweep panel: for each of the four sweeps, a
// population × parameter matrix of (corrected dome, TV lineage divergence, signed mean lineage-age gap).
// dome comes from aggregate.json (raw - pure-harvester baseline); TV and gap come from the last-third
// pooled gsp distributions (planted vs harvested), pulled at REPS=4 to match the collapse figure and stay
// fast. Own cache (megafig-cache.json) so reruns are cheap. Writes data/<coll>/megafig-data.json.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { connect, find, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };
const agg = JSON.parse(fs.readFileSync(path.join(DIR, 'aggregate.json'), 'utf8'));
const key = p => `${p.humanAddRate}|${p.numPlanters}|${p.metabolicThreshold}|${p.plantSelectionStrength}|${p.plantSelectionChance}|${p.harvestStrategy}|${p.plantStrategy}`;
const dome = {}; for (const s of agg) dome[key(s.params)] = s.conflatedMean;
const nBySetting = {}; for (const s of agg) nBySetting[s.setting] = s.n;

const A = { metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' };
const POPS = []; for (let p = 10; p <= 160; p += 10) POPS.push(p);
const PL = []; for (let p = 0; p <= 160; p += 10) PL.push(p);
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
const SEL = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const EN = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const baseAt = pop => dome[key({ ...A, humanAddRate: pop, numPlanters: 0 })];
const baseEnergy = (pop, mt) => dome[key({ ...A, humanAddRate: pop, numPlanters: 0, metabolicThreshold: mt })];

const SWEEPS = [
  { key: 'pp', label: 'planting effort', colLabel: 'planters', cols: PL, cp: (pop, np) => np > pop ? null : ({ ...A, humanAddRate: pop, numPlanters: np }), base: (pop) => baseAt(pop) },
  { key: 'saved', label: 'seeds saved', colLabel: 'fraction saved', cols: SAVED, cp: (pop, s) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionStrength: s }), base: (pop) => baseAt(pop) },
  { key: 'selective', label: 'planting selectivity', colLabel: 'fraction selective', cols: SEL, cp: (pop, c) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionChance: c }), base: (pop) => baseAt(pop) },
  { key: 'energy', label: 'metabolic energy', colLabel: 'energy threshold', cols: EN, cp: (pop, mt) => ({ ...A, humanAddRate: pop, numPlanters: pop, metabolicThreshold: mt }), base: (pop, mt) => baseEnergy(pop, mt) },
];

function pooledDist(docs, field) { const out = new Array(20).fill(0);
  for (const d of docs) { const g = d[field]; if (!Array.isArray(g) || !g.length) continue; const t0 = Math.floor(g.length * 2 / 3);
    for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) out[b] += (g[t][b] || 0); }
  const tot = out.reduce((a, v) => a + v, 0); return tot ? out.map(v => v / tot) : null; }
const tvDist = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);
const meanBin = D => D.reduce((a, v, b) => a + b * v, 0);

const socket = connect();
let connected = false;
socket.on('connect_error', () => { if (!connected) process.exit(1); });
socket.on('connect', async () => {
  if (connected) return; connected = true;
  const CACHE = path.join(DIR, 'megafig-cache.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const cells = new Map();
  for (const sw of SWEEPS) for (const pop of POPS) for (const v of sw.cols) { const p = sw.cp(pop, v); if (p && p.numPlanters > 0) cells.set(key(p), p); }
  const metric = {}; let i = 0, pulls = 0;
  for (const [k, p] of cells) {
    const sk = settingKey({ ...BASE, ...p }), curN = nBySetting[sk] || 0, c = cache[sk];
    if (c && c.n === curN && c.tv != null && c.gap != null) { metric[k] = { tv: c.tv, gap: c.gap }; continue; }
    const docs = await find(socket, COLL, { setting: sk }, { plantedGspData: 1, harvestedGspData: 1 }, 4, 0, 60000);
    pulls++;
    if (!docs || !docs.length) continue;
    const Pp = pooledDist(docs, 'plantedGspData'), Ph = pooledDist(docs, 'harvestedGspData');
    if (!Pp || !Ph) continue;
    const tv = tvDist(Pp, Ph), gap = meanBin(Ph) - meanBin(Pp);
    metric[k] = { tv, gap }; cache[sk] = { n: curN, tv, gap };
    if (++i % 40 === 0) { process.stderr.write(`${i} computed (${pulls} pulls)\n`); try { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch {} }  // incremental flush ⇒ resumable
  }
  try { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch {}

  const out = [];
  for (const sw of SWEEPS) {
    const domeM = [], divM = [], gapM = [];
    for (const pop of POPS) {
      const dR = [], vR = [], gR = [];
      for (const v of sw.cols) {
        const p = sw.cp(pop, v);
        if (!p) { dR.push(null); vR.push(null); gR.push(null); continue; }
        const raw = dome[key(p)], b = sw.base(pop, v);
        dR.push(raw != null && b != null ? +(raw - b).toFixed(4) : null);
        const m = metric[key(p)];
        vR.push(m ? +m.tv.toFixed(4) : null);
        gR.push(m ? +m.gap.toFixed(4) : null);
      }
      domeM.push(dR); divM.push(vR); gapM.push(gR);
    }
    out.push({ key: sw.key, label: sw.label, colLabel: sw.colLabel, rows: POPS, cols: sw.cols, dome: domeM, div: divM, gap: gapM });
  }
  fs.writeFileSync(path.join(DIR, 'megafig-data.json'), JSON.stringify({ sweeps: out }));
  console.log(`gen-megafig-data: ${cells.size} cells, ${pulls} pulls -> megafig-data.json`);
  socket.close(); process.exit(0);
});
setTimeout(() => { console.log('watchdog timeout'); process.exit(1); }, 1200000);
