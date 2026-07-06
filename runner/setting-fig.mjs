// setting-fig.mjs <collection> <settingKey> [outfile] — render ONE setting's aggregated data:
// the population/seed trajectory + all 15 distribution histograms (population / planted / harvested
// × gsp + 4 genes), summed over every replicate of that setting. Writes an SVG (or prints it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const KEY = process.argv[3] || '';
const OUT = process.argv[4] || null;

const COLS = [['gsp', 'Gsp', 'gsp / lineage'], ['weight', 'Weight', 'weight'], ['root', 'Root', 'root depth'], ['seed', 'Seed', 'fecundity'], ['dispersal', 'Dispersal', 'dispersal']];
const ROWS = [['pop', 'population — all'], ['popWild', 'population — wild'], ['popDome', 'population — domesticated'], ['planted', 'planted (sown)'], ['harvested', 'harvested (plucked)']];
function fieldName(type, popBase, cap) {
  if (type === 'popWild') return popBase + 'DataWild';
  if (type === 'popDome') return popBase + 'DataDomesticated';
  if (type === 'planted' || type === 'harvested') return type + cap + 'Data';
  return popBase + 'Data';   // population (all)
}

// histogram.js per-column log color (white→blue)
function color(prop) { let c = prop * 99 + 1; c = 511 - Math.floor(Math.log(c) / Math.log(100) * 512);
  if (c > 255) { c -= 256; return `rgb(${c},${c},255)`; } return `rgb(0,0,${Math.max(0, c)})`; }
// 600×20 histogram-over-time, per-column normalized
function panel(data, x0, y0, W, H) {
  const T = data.length, B = 20, cols = Math.min(90, T), step = T / cols, cw = W / cols, ch = H / B;
  let s = '';
  for (let cx = 0; cx < cols; cx++) {
    const t = Math.floor(cx * step), colSum = data[t].reduce((a, v) => a + v, 0) || 1;
    for (let b = 0; b < B; b++) s += `<rect x="${(x0 + cx * cw).toFixed(1)}" y="${(y0 + (19 - b) * ch).toFixed(1)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${color(data[t][b] / colSum)}"/>`;
  }
  return s + `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="none" stroke="#999"/>`;
}
// line plot of the population trajectories
function linePanel(seriesList, x0, y0, W, H) {
  const L = Math.max(...seriesList.map(s => s.data.length), 1);
  const max = Math.max(1, ...seriesList.flatMap(s => s.data));
  const X = i => x0 + (i / (L - 1 || 1)) * W, Y = v => y0 + H - (v / max) * H;
  let s = `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="#fff" stroke="#999"/>`;
  for (const ser of seriesList) {
    let d = ''; ser.data.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; });
    s += `<path d="${d}" fill="none" stroke="${ser.color}" stroke-width="1.4"/>`;
  }
  s += `<text x="${x0 + 2}" y="${y0 + 11}" font-size="10" fill="#555">seed population — total(green) / wild(orange) / domesticated(blue), peak ${Math.round(max)}</text>`;
  return s;
}

const socket = connect();
socket.on('connect_error', e => { process.stderr.write('connect_error ' + e.message); process.exit(1); });
socket.on('connect', async () => {
  const docs = await findAll(socket, COLL, { setting: KEY }, null);
  const W = 96 + COLS.length * (180 + 16), padL = 96, padT = 210, PW = 180, PH = 62, gapX = 16, gapY = 22;
  const H = padT + ROWS.length * (PH + gapY) + 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  if (!docs.length) {
    svg += `<text x="16" y="30" font-size="13" fill="#900">no data for this setting yet</text></svg>`;
  } else {
    // sum the 15 histogram series across replicates
    const sum = {};
    for (const [prefix] of ROWS) for (const [popBase, cap] of COLS) {
      const f = fieldName(prefix, popBase, cap);
      const acc = docs[0][f]?.map(r => r.slice()) || null; if (!acc) continue;
      for (let d = 1; d < docs.length; d++) { const g = docs[d][f]; if (!g) continue; for (let t = 0; t < acc.length; t++) for (let b = 0; b < 20; b++) acc[t][b] += (g[t]?.[b] || 0); }
      sum[f] = acc;
    }
    // average the population trajectories across replicates
    const avg = field => { const arrs = docs.map(d => d[field]).filter(Array.isArray); if (!arrs.length) return []; const Ln = Math.min(...arrs.map(a => a.length)); const o = []; for (let t = 0; t < Ln; t++) { let s = 0; for (const a of arrs) s += a[t]; o.push(s / arrs.length); } return o; };
    const domeVal = docs.reduce((a, d) => a + (d.dome || 0), 0) / docs.length;
    svg += `<text x="10" y="22" font-size="15" font-weight="700" fill="#111">${KEY.replace(/\|/g, '  ')}</text>`;
    svg += `<text x="10" y="40" font-size="12" fill="#777">n=${docs.length} replicates · dome ${domeVal.toFixed(3)} · value low→high bottom→top, time→right</text>`;
    svg += linePanel([{ data: avg('seedPop'), color: '#3a7' }, { data: avg('wildSeedPop'), color: '#e80' }, { data: avg('domeSeedPop'), color: '#48c' }], padL, 52, W - padL - 16, 140);
    COLS.forEach(([, , clbl], c) => { svg += `<text x="${padL + c * (PW + gapX) + PW / 2}" y="${padT - 6}" font-size="10" fill="#555" text-anchor="middle">${clbl}</text>`; });
    ROWS.forEach(([prefix, rlbl], r) => {
      const y = padT + r * (PH + gapY);
      svg += `<text x="8" y="${y + PH / 2}" font-size="10" font-weight="600" fill="#333">${rlbl}</text>`;
      COLS.forEach(([popBase, cap], c) => { const f = fieldName(prefix, popBase, cap); if (sum[f]) svg += panel(sum[f], padL + c * (PW + gapX), y, PW, PH); });
    });
    svg += `</svg>`;
  }
  if (OUT) fs.writeFileSync(OUT, svg); else process.stdout.write(svg);
  socket.close(); process.exit(0);
});
setTimeout(() => process.exit(1), 60000);
