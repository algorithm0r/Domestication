// agg-cross-saved.mjs — read the saved% × pop cross and identify the peak saved%.
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
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.30, 0.50];
const POPS  = [40, 60, 80, 100, 120, 140];
const sid = s => 's' + String(Math.round(s * 100)).padStart(3, '0');

console.log('saved% × pop  —  dome fraction (energy 20, all-plant, selective 100%)\n');
console.log('pop \\ saved%  ' + SAVED.map(s => s.toFixed(2).padStart(7)).join('') + '    peak@pop');
const colBest = SAVED.map(() => ({ sum: 0, n: 0 }));
let overall = { v: -1, pop: '-', s: '-' };
for (const pop of POPS) {
  let row = '  pop ' + String(pop).padStart(3) + '   ';
  let best = { v: -1, s: '-' };
  SAVED.forEach((s, i) => {
    const v = dome(`saved_pop${pop}_${sid(s)}`);
    row += (v == null ? '   ·  ' : v.toFixed(3)).padStart(7);
    if (v != null) { colBest[i].sum += v; colBest[i].n++; if (v > best.v) best = { v, s }; if (v > overall.v) overall = { v, pop, s }; }
  });
  row += '    ' + (best.v >= 0 ? `${best.s} (${best.v.toFixed(3)})` : '-');
  console.log(row);
}
console.log('\n  col mean   ' + colBest.map(c => (c.n ? (c.sum / c.n).toFixed(3) : '  ·  ').padStart(7)).join(''));
const bestCol = colBest.map((c, i) => ({ s: SAVED[i], m: c.n ? c.sum / c.n : -1 })).sort((a, b) => b.m - a.m)[0];
const done = POPS.flatMap(p => SAVED.map(s => dome(`saved_pop${p}_${sid(s)}`))).filter(v => v != null).length;
console.log(`\n${done}/${POPS.length * SAVED.length} cells done.`);
console.log(`PEAK saved% (by column mean across pop): ${bestCol.s}  (mean dome ${bestCol.m >= 0 ? bestCol.m.toFixed(3) : '-'})`);
console.log(`single best cell: saved=${overall.s} @ pop${overall.pop} = ${overall.v >= 0 ? overall.v.toFixed(3) : '-'}`);
console.log(`(old default saved% = 0.20)`);
