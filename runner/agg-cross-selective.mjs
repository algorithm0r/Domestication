// agg-cross-selective.mjs — read the selective% × pop cross and report the peak.
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
const CHANCE = [0.0, 0.25, 0.50, 0.75, 1.0];
const POPS   = [40, 60, 80, 100, 120, 140];
const cid = c => 'c' + String(Math.round(c * 100)).padStart(3, '0');

console.log('selective% × pop  —  dome fraction (energy 20, saved 0.20, all-plant)\n');
console.log('pop \\ chance  ' + CHANCE.map(c => c.toFixed(2).padStart(7)).join('') + '    peak@pop');
const colBest = CHANCE.map(() => ({ sum: 0, n: 0 }));
let overall = { v: -1, pop: '-', c: '-' };
for (const pop of POPS) {
  let row = '  pop ' + String(pop).padStart(3) + '   ';
  let best = { v: -1, c: '-' };
  CHANCE.forEach((c, i) => {
    const v = dome(`selective_pop${pop}_${cid(c)}`);
    row += (v == null ? '   ·  ' : v.toFixed(3)).padStart(7);
    if (v != null) { colBest[i].sum += v; colBest[i].n++; if (v > best.v) best = { v, c }; if (v > overall.v) overall = { v, pop, c }; }
  });
  row += '    ' + (best.v >= 0 ? `${best.c} (${best.v.toFixed(3)})` : '-');
  console.log(row);
}
console.log('\n  col mean   ' + colBest.map(c => (c.n ? (c.sum / c.n).toFixed(3) : '  ·  ').padStart(7)).join(''));
const bestCol = colBest.map((c, i) => ({ c: CHANCE[i], m: c.n ? c.sum / c.n : -1 })).sort((a, b) => b.m - a.m)[0];
const done = POPS.flatMap(p => CHANCE.map(c => dome(`selective_pop${p}_${cid(c)}`))).filter(v => v != null).length;
console.log(`\n${done}/${POPS.length * CHANCE.length} cells done.`);
console.log(`PEAK selective% (by column mean across pop): ${bestCol.c}  (mean dome ${bestCol.m >= 0 ? bestCol.m.toFixed(3) : '-'})`);
console.log(`single best cell: chance=${overall.c} @ pop${overall.pop} = ${overall.v >= 0 ? overall.v.toFixed(3) : '-'}`);
console.log(`(old default selective% = 1.0)`);
