// agg-volatility.mjs — summarize run-to-run variation from the vol_* replicates.
// Same dome metric as agg.mjs (mean dome fraction over the final third of the run).
// Reports per-cell n, mean, SD, CV, min, max so we can quote a noise floor (R1.4).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

function dome(file) {
  try { const o = JSON.parse(fs.readFileSync(file, 'utf8')), d = o.data, n = d.seedPop.length, st = Math.floor(n * 0.67);
    let dm = 0, c = 0; for (let i = st; i < n; i++) if (d.seedPop[i] > 0) { dm += d.domeSeedPop[i] / d.seedPop[i]; c++; }
    return c ? dm / c : null; } catch { return null; }
}
function finalPop(file) {
  try { const o = JSON.parse(fs.readFileSync(file, 'utf8')); return o.stats?.finalPop ?? null; } catch { return null; }
}

const dir = path.join(HERE, 'results');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('vol_') && f.endsWith('.json')) : [];
const cells = {};
for (const f of files) {
  const m = f.match(/^(vol_pop\d+_pl\d+)_r\d+\.json$/); if (!m) continue;
  (cells[m[1]] ||= []).push(path.join(dir, f));
}

const stats = a => { const n = a.length, mean = a.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / (n > 1 ? n - 1 : 1));
  return { n, mean, sd, cv: mean ? sd / mean : 0, min: Math.min(...a), max: Math.max(...a) }; };

console.log('Run-to-run variation (R1.4) — dome fraction across replicates of each cell\n');
console.log('cell'.padEnd(20), 'n'.padStart(3), 'mean'.padStart(8), 'SD'.padStart(8), 'CV'.padStart(7), 'min'.padStart(8), 'max'.padStart(8), 'range'.padStart(8), '  pop(SD)');
const order = Object.keys(cells).sort();
for (const cell of order) {
  const ds = cells[cell].map(dome).filter(v => v != null);
  const ps = cells[cell].map(finalPop).filter(v => v != null);
  if (!ds.length) { console.log(cell.padEnd(20), '(no parseable results yet)'); continue; }
  const s = stats(ds), psd = ps.length > 1 ? stats(ps).sd : 0;
  console.log(cell.replace('vol_', '').padEnd(20), String(s.n).padStart(3),
    s.mean.toFixed(4).padStart(8), s.sd.toFixed(4).padStart(8), (s.cv * 100).toFixed(1).padStart(6) + '%',
    s.min.toFixed(4).padStart(8), s.max.toFixed(4).padStart(8), (s.max - s.min).toFixed(4).padStart(8),
    '  ±' + Math.round(psd));
}
const totalDone = order.reduce((s, c) => s + cells[c].length, 0);
console.log(`\n${order.length} cells, ${totalDone} replicate results on disk.`);
console.log('SD = run-to-run standard deviation of the dome fraction; CV = SD/mean; pop(SD) = SD of final seed population.');
