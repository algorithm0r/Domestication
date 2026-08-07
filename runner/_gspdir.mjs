// _gspdir.mjs — is the PLANTED lineage actually younger (lower gsp) than the HARVESTED population?
// TV is symmetric and hides direction; this reports the mean gsp bin of the planted vs harvested
// distributions (last third of the run) for several experiments, so we can see the sign of the divergence.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = 'domestication-final-2026';
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const byId = {}; for (const s of settings) byId[s.id] = s;
const LIST = [
  ['p03_wt3_plantrandom', 'WT III random plant (dome~0)'],
  ['p20_plant_bottom', 'plant bottom (dome .48) NOT gsp-selected'],
  ['p19_plant_minDispersal', 'plant non-shatter (dome .53) NOT gsp-selected'],
  ['p12_plant_maxRoots', 'plant max roots (dome .52) NOT gsp-selected'],
  ['p21_plant_top', 'plant top (dome .02)'],
  ['lin_mingsp_pop80', 'plant MIN gsp (freshest) — by construction'],
  ['lin_maxgsp_pop80', 'plant MAX gsp (oldest) — by construction'],
];
const PROJ = { plantedGspData: 1, harvestedGspData: 1 };
function dist(docs, f) { const o = new Array(20).fill(0); for (const d of docs) { const g = d[f]; if (!Array.isArray(g) || !g.length) continue; const t0 = Math.floor(g.length * 2 / 3); for (let t = t0; t < g.length; t++) for (let b = 0; b < 20; b++) o[b] += (g[t][b] || 0); } const tot = o.reduce((a, v) => a + v, 0); return tot ? o.map(v => v / tot) : null; }
const meanBin = D => D ? D.reduce((a, v, b) => a + b * v, 0) : null;         // weighted mean gsp bin
const loFrac = D => D ? D.slice(0, 4).reduce((a, v) => a + v, 0) : null;      // fraction in the youngest 4 bins
const tv = (P, Q) => 0.5 * P.reduce((a, v, b) => a + Math.abs(v - Q[b]), 0);
const pull = key => new Promise(res => { const s = connect(); let done = false; const fin = v => { if (done) return; done = true; try { s.close(); } catch {}; res(v); };
  s.on('connect', async () => { try { fin(await findAll(s, COLL, { setting: key }, PROJ)); } catch { fin(null); } });
  s.on('connect_error', () => fin(null)); setTimeout(() => fin(done ? undefined : null), 90000); });

console.log('experiment'.padEnd(46), 'plantedGsp', 'harvGsp', ' Δmean', ' planted<4bin', 'harv<4bin', ' TV');
console.log('-'.repeat(110));
for (const [id, label] of LIST) {
  const cfg = byId[id]; if (!cfg) { console.log(label.padEnd(46), 'NOSET'); continue; }
  const docs = await pull(settingKey(cfg.config));
  if (!docs) { console.log(label.padEnd(46), 'FAIL'); continue; }
  const P = dist(docs, 'plantedGspData'), H = dist(docs, 'harvestedGspData');
  const mp = meanBin(P), mh = meanBin(H);
  console.log(label.padEnd(46),
    (mp == null ? '-' : mp.toFixed(2)).padStart(9), (mh == null ? '-' : mh.toFixed(2)).padStart(8),
    (mp == null || mh == null ? '-' : (mp - mh).toFixed(2)).padStart(6),
    (loFrac(P) == null ? '-' : loFrac(P).toFixed(2)).padStart(11), (loFrac(H) == null ? '-' : loFrac(H).toFixed(2)).padStart(9),
    (P && H ? tv(P, H).toFixed(2) : '-').padStart(6));
}
process.exit(0);
