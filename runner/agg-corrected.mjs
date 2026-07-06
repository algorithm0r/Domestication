// agg-corrected.mjs — domestication map corrected against the pure-harvester baseline.
// For each row (harvester count h), the pl0 cell is harvest-only (WT2): no planting.
// At low population that baseline is non-zero (the WT1 minimize-genes artifact bleeds in).
// We report planting-induced domestication = dome(h,p) - dome(h,0), so the artifact is
// subtracted out and what remains is the effect attributable to planting.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

function dome(id) {
  const f = path.join(HERE, 'results', id + '.json');
  if (!fs.existsSync(f)) return null;
  try { const o = JSON.parse(fs.readFileSync(f, 'utf8')), d = o.data, n = d.seedPop.length, st = Math.floor(n * 0.67);
    let dm = 0, c = 0; for (let i = st; i < n; i++) if (d.seedPop[i] > 0) { dm += d.domeSeedPop[i] / d.seedPop[i]; c++; }
    return c ? dm / c : null; } catch { return null; }
}
const POPS = []; for (let h = 60; h <= 200; h += 10) POPS.push(h);
const PL = [];   for (let p = 0; p <= 200; p += 10) PL.push(p);
// corrected scale (delta above baseline): negatives clamp to '~'
const sym = v => v == null ? '·' : v < 0 ? '~' : v < 0.01 ? '.' : v < 0.05 ? ':' : v < 0.15 ? 'o' : v < 0.4 ? 'O' : '#';

console.log('Baseline-corrected domestication  —  dome(h,p) minus pure-harvester dome(h,0)');
console.log('  scale:  ~ <0 (below baseline)   . <.01   : <.05   o <.15   O <.4   # >=.4      ·=missing');
console.log('  cols = planters 0 -> 200 step 10  (| marks 0,40,80,120,160,200)');
console.log('             ' + PL.map((p, i) => i % 4 === 0 ? '|' : ' ').join(''));
console.log('  baseline = pure-harvester dome(h,0), shown at right →');
let best = { v: -1, id: '-' };
for (const h of POPS) {
  const base = dome(`pop${h}_pl0`);
  let row = '  harv ' + String(h).padStart(3) + ' : ';
  for (const p of PL) {
    if (p > h) { row += '-'; continue; }
    const v = dome(`pop${h}_pl${p}`);
    if (v == null || base == null) { row += '·'; continue; }
    const d = v - base;
    if (d > best.v) best = { v: d, id: `pop${h}_pl${p}` };
    row += sym(d);
  }
  row += '   base=' + (base == null ? ' -  ' : base.toFixed(3));
  console.log(row);
}
console.log('');
console.log(`largest planting-induced gain: ${best.id} = +${best.v >= 0 ? best.v.toFixed(3) : '-'} above its row baseline`);
