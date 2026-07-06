// agg.mjs — render the population x #planters domestication map from results/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const md = h => h.reduce((s, v, i) => s + v * (i + 0.5) / 20, 0);
function dome(id) {
  const f = path.join(HERE, 'results', id + '.json');
  if (!fs.existsSync(f)) return null;
  try { const o = JSON.parse(fs.readFileSync(f, 'utf8')), d = o.data, n = d.seedPop.length, st = Math.floor(n * 0.67);
    let dm = 0, c = 0; for (let i = st; i < n; i++) if (d.seedPop[i] > 0) { dm += d.domeSeedPop[i] / d.seedPop[i]; c++; }
    return c ? dm / c : null; } catch { return null; }
}
const POPS = []; for (let h = 60; h <= 200; h += 10) POPS.push(h);
const PL = [];   for (let p = 0; p <= 200; p += 10) PL.push(p);
const sym = v => v == null ? '·' : v < 0.01 ? '.' : v < 0.05 ? ':' : v < 0.15 ? 'o' : v < 0.4 ? 'O' : '#';

let done = 0, tot = 0, best = { v: -1, id: '-' };
console.log('Domestication map  —  rows = harvesters (predation),  cols = #planters (effort)');
console.log('  scale:  . <.01   : <.05   o <.15   O <.4   # >=.4      ·=pending   -=planters>harvesters');
console.log('  cols = planters 0 -> 200 step 10  (| marks 0,40,80,120,160,200)');
console.log('             ' + PL.map((p, i) => i % 4 === 0 ? '|' : ' ').join(''));
for (const h of POPS) {
  let row = '  harv ' + String(h).padStart(3) + ' : ';
  for (const p of PL) {
    if (p > h) { row += '-'; continue; }
    tot++; const v = dome(`pop${h}_pl${p}`);
    if (v != null) { done++; if (v > best.v) best = { v, id: `pop${h}_pl${p}` }; row += sym(v); }
    else row += '·';
  }
  console.log(row);
}
console.log('');
console.log(`done ${done}/${tot} cells  |  most-domesticated so far: ${best.id} = ${best.v >= 0 ? best.v.toFixed(3) : '-'}`);
