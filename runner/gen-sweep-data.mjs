// gen-sweep-data.mjs [collection] — export the sweep matrices (corrected dome + lineage divergence)
// as JSON for the matplotlib renderer (heat_sweeps.py), so the sweep figures match the paper style.
// dome = conflatedMean - pure-harvester baseline (as in mongo-figs); divergence = TV distance between
// the planted and harvested gsp distributions (as in div-figs). Writes data/<coll>/sweepdata/<key>.json
// = { rows, cols, colLabel, rowLabel, dome:[[..]], div:[[..]] } with null for out-of-range/missing cells.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
const OUT = path.join(DIR, 'sweepdata');
fs.mkdirSync(OUT, { recursive: true });
const BASE = { epoch: 100000, humansAdded: 25000, plantingTime: 50000, predationChance: 0 };

const agg = JSON.parse(fs.readFileSync(path.join(DIR, 'aggregate.json'), 'utf8'));
const key = p => `${p.humanAddRate}|${p.numPlanters}|${p.metabolicThreshold}|${p.plantSelectionStrength}|${p.plantSelectionChance}|${p.harvestStrategy}|${p.plantStrategy}`;
const dome = {}; for (const s of agg) dome[key(s.params)] = s.conflatedMean;      // raw dome by 7-field key

const A = { metabolicThreshold: 20, plantSelectionStrength: 0.2, plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom' };
const POPS = []; for (let p = 10; p <= 160; p += 10) POPS.push(p);
const PL = []; for (let p = 0; p <= 160; p += 10) PL.push(p);   // planters axis mirrors population (np capped at pop)
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
const SEL = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const EN = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// baselines (pure-harvester, numPlanters 0)
const baseAt = pop => dome[key({ ...A, humanAddRate: pop, numPlanters: 0 })];
const baseEnergy = (pop, mt) => dome[key({ ...A, humanAddRate: pop, numPlanters: 0, metabolicThreshold: mt })];

const SWEEPS = [
  { key: 'pp', colLabel: 'planting effort (planters)', COLS: PL, pops: POPS,
    cellParams: (pop, np) => np > pop ? null : ({ ...A, humanAddRate: pop, numPlanters: np }), base: (pop) => baseAt(pop) },
  { key: 'saved', colLabel: 'seeds saved (fraction)', COLS: SAVED, pops: POPS,
    cellParams: (pop, s) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionStrength: s }), base: (pop) => baseAt(pop) },
  { key: 'selective', colLabel: 'selective planters (fraction)', COLS: SEL, pops: POPS,
    cellParams: (pop, c) => ({ ...A, humanAddRate: pop, numPlanters: pop, plantSelectionChance: c }), base: (pop) => baseAt(pop) },
  { key: 'energy', colLabel: 'metabolic energy', COLS: EN, pops: POPS,
    cellParams: (pop, mt) => ({ ...A, humanAddRate: pop, numPlanters: pop, metabolicThreshold: mt }), base: (pop, mt) => baseEnergy(pop, mt) },
];

// divergence: pooled last-third normalized gsp distribution, TV distance planted vs harvested
function pooledDist(docs, field) {
  const out = new Array(20).fill(0);
  for (const d of docs) { const g = d[field]; if (!Array.isArray(g) || !g.length) continue;
    const t0 = Math.floor(g.length * 2 / 3); for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) out[b] += (g[t][b] || 0); }
  const tot = out.reduce((a, v) => a + v, 0); return tot ? out.map(v => v / tot) : null;
}
const tvDist = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);

const socket = connect();
let connected = false;
// only bail if we never connected; a reconnect blip mid-run shouldn't kill it (socket.io retries)
socket.on('connect_error', e => { console.log('connect_error', e.message); if (!connected) process.exit(1); });
socket.on('connect', async () => {
  if (connected) return; connected = true;   // socket.io re-fires 'connect' on reconnect — run the body once
  // unique cells for divergence queries
  const cells = new Map();
  for (const sw of SWEEPS) for (const pop of sw.pops) for (const v of sw.COLS) { const p = sw.cellParams(pop, v); if (p) cells.set(key(p), p); }
  // SHARED divergence cache (same file div-figs/collapse-fig use): recompute a cell only when its rep count
  // changed (agg gives n per settingKey). Completeness guard: never cache a truncated pull. Usually all-hits.
  const CACHE = path.join(DIR, 'divergence-cache.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const nBySetting = {}; for (const s of agg) nBySetting[s.setting] = s.n;
  const div = {};
  for (const [k, p] of cells) {
    if (p.numPlanters === 0) continue;                                        // no planting ⇒ div 0-filled below
    const sk = settingKey({ ...BASE, ...p }), curN = nBySetting[sk] || 0, c = cache[sk];
    if (c && c.n === curN) { if (c.tv != null) div[k] = c.tv; continue; }     // rep count unchanged ⇒ cached TV
    const docs = await findAll(socket, COLL, { setting: sk }, { plantedGspData: 1, harvestedGspData: 1 });
    if (docs.length < curN) { if (c && c.tv != null) div[k] = c.tv; continue; }   // truncated pull ⇒ keep old, retry
    const Pp = pooledDist(docs, 'plantedGspData'), Ph = pooledDist(docs, 'harvestedGspData');
    const tv = (Pp && Ph) ? tvDist(Pp, Ph) : null;
    if (tv != null) div[k] = tv;
    cache[sk] = { n: curN, tv };
  }
  try { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch {}
  for (const sw of SWEEPS) {
    const domeM = [], divM = [];
    for (const pop of sw.pops) {
      const dRow = [], vRow = [];
      for (const v of sw.COLS) {
        const params = sw.cellParams(pop, v);
        if (!params) { dRow.push(null); vRow.push(null); continue; }
        const raw = dome[key(params)], b = sw.base(pop, v);
        dRow.push(raw != null && b != null ? +(raw - b).toFixed(4) : null);
        // no planting (numPlanters 0) => there is nothing sown to differ from what's plucked => divergence 0
        const k = key(params); vRow.push(params.numPlanters === 0 ? 0 : (div[k] != null ? +div[k].toFixed(4) : null));
      }
      domeM.push(dRow); divM.push(vRow);
    }
    fs.writeFileSync(path.join(OUT, `${sw.key}.json`), JSON.stringify({ key: sw.key, rows: sw.pops, cols: sw.COLS, colLabel: sw.colLabel, rowLabel: 'human population', dome: domeM, div: divM }));
  }
  console.log(`gen-sweep-data: wrote ${SWEEPS.length} sweep matrices (dome+div) -> ${OUT}`);
  socket.close(); process.exit(0);
});
// watchdog: the divergence loop does one Mongo array-pull per unique cell, serially — it grows with the
// grid (863+ settings => ~600 queries). 180s used to fire mid-loop and exit before writing any JSON, so a
// larger grid silently left the sweep figures stale. 20 min gives it real headroom.
setTimeout(() => { console.log('watchdog timeout'); process.exit(1); }, 1200000);
