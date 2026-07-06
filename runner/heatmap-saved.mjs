// heatmap-saved.mjs — render the saved% × pop cross as an annotated viridis heatmap (SVG).
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
const SAVED = [0.05, 0.10, 0.15, 0.20, 0.30, 0.50];   // columns
const POPS  = [40, 60, 80, 100, 120, 140];            // rows
const sid = s => 's' + String(Math.round(s * 100)).padStart(3, '0');

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
function viridis(t) {
  const stops = [[68,1,84],[59,82,139],[33,144,141],[93,201,99],[253,231,37]];
  t = Math.max(0, Math.min(1, t)); const x = t * (stops.length - 1), i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  return [lerp(a[0],b[0],f), lerp(a[1],b[1],f), lerp(a[2],b[2],f)];
}
// grid + max
const grid = {}; let max = 0;
for (const p of POPS) for (const s of SAVED) { const v = dome(`saved_pop${p}_${sid(s)}`); grid[`${p}_${s}`] = v; if (v != null && v > max) max = v; }

const CW = 84, CH = 46, padL = 78, padT = 78, padR = 96, padB = 56;
const W = padL + SAVED.length * CW + padR, H = padT + POPS.length * CH + padB;
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,Segoe UI,sans-serif">`;
s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
s += `<text x="${padL}" y="30" font-size="17" font-weight="700" fill="#111">Domestication vs saved% × population</text>`;
s += `<text x="${padL}" y="50" font-size="12" fill="#666">dome fraction; energy 20, all-planting, 100% selective. Peak shifts right (0.15→0.20) as population rises.</text>`;
for (let ri = 0; ri < POPS.length; ri++) for (let ci = 0; ci < SAVED.length; ci++) {
  const p = POPS[ri], sv = SAVED[ci], v = grid[`${p}_${sv}`], x = padL + ci * CW, y = padT + ri * CH;
  const [r, g, b] = v == null ? [204,204,204] : viridis(v / max);
  s += `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="${hex(r,g,b)}" stroke="#fff" stroke-width="1"/>`;
  if (v != null) {
    const lum = 0.299*r + 0.587*g + 0.114*b;                 // dark text on light cells, light on dark
    s += `<text x="${x+CW/2}" y="${y+CH/2+4}" font-size="13" text-anchor="middle" fill="${lum>140?'#111':'#fff'}">${v.toFixed(3)}</text>`;
  }
}
// axis labels + ticks
s += `<text x="${padL + SAVED.length*CW/2}" y="${H-16}" font-size="13" fill="#222" text-anchor="middle">saved% (plantSelectionStrength) →</text>`;
s += `<text x="20" y="${padT + POPS.length*CH/2}" font-size="13" fill="#222" text-anchor="middle" transform="rotate(-90 20 ${padT + POPS.length*CH/2})">population (harvesters) →</text>`;
SAVED.forEach((sv, ci) => s += `<text x="${padL + ci*CW + CW/2}" y="${padT-8}" font-size="12" fill="#555" text-anchor="middle">${sv.toFixed(2)}</text>`);
POPS.forEach((p, ri) => s += `<text x="${padL-10}" y="${padT + ri*CH + CH/2 + 4}" font-size="12" fill="#555" text-anchor="end">${p}</text>`);
// colorbar
const cbx = padL + SAVED.length*CW + 26, cbY = padT, cbH = POPS.length*CH, cbW = 16, N = 60;
for (let i = 0; i < N; i++) { const [r,g,b] = viridis(i/(N-1)); s += `<rect x="${cbx}" y="${cbY+cbH-(i+1)*cbH/N}" width="${cbW}" height="${cbH/N+0.5}" fill="${hex(r,g,b)}"/>`; }
s += `<rect x="${cbx}" y="${cbY}" width="${cbW}" height="${cbH}" fill="none" stroke="#aaa"/>`;
[[0,'0'],[0.5,(max/2).toFixed(2)],[1,max.toFixed(2)]].forEach(([t,l]) => s += `<text x="${cbx+cbW+5}" y="${cbY+cbH-t*cbH+4}" font-size="11" fill="#444">${l}</text>`);
s += `</svg>`;
fs.writeFileSync(path.join(HERE, 'cross_saved.svg'), s);
console.log(`wrote cross_saved.svg (max dome ${max.toFixed(3)})`);
