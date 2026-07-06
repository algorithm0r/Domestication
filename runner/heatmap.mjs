// heatmap.mjs — render the population x #planters domestication sweep as SVG heatmaps.
// Writes two files: domestication_raw.svg and domestication_corrected.svg.
//   raw       = dome fraction (seeds with dispersal<0.6 in the final third of the run)
//   corrected = dome(h,p) minus the pure-harvester baseline dome(h,0)  (artifact removed)
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
const HARV = []; for (let h = 10; h <= 200; h += 10) HARV.push(h);   // rows
const PL = [];   for (let p = 0; p <= 200; p += 10) PL.push(p);      // cols

// --- color maps -----------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
// sequential: viridis (perceptually uniform, colorblind-safe). domain 0..max
function seq(t) {                       // t in [0,1]
  const stops = [[68,1,84],[59,82,139],[33,144,141],[93,201,99],[253,231,37]]; // viridis
  t = Math.max(0, Math.min(1, t)); const x = t * (stops.length - 1), i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  return hex(lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f));
}
// corrected: viridis for >=0; small negatives (below baseline) shown neutral gray
function div(v, max) {                   // v signed, max scales the positive side
  if (v >= 0) return seq(v / max);
  return '#454545';                      // below-baseline cells (tiny, rare)
}

// --- collect data ---------------------------------------------------------
const raw = {}; let rawMax = 0;
for (const h of HARV) for (const p of PL) if (p <= h) { const v = dome(`pop${h}_pl${p}`); raw[`${h}_${p}`] = v; if (v != null && v > rawMax) rawMax = v; }
const base = {}; for (const h of HARV) base[h] = dome(`pop${h}_pl0`);
const corr = {}; let corrMax = 0;
for (const h of HARV) for (const p of PL) if (p <= h) { const v = raw[`${h}_${p}`], b = base[h]; const d = (v != null && b != null) ? v - b : null; corr[`${h}_${p}`] = d; if (d != null && d > corrMax) corrMax = d; }

// --- svg builder ----------------------------------------------------------
const CELL = 26, padL = 70, padT = 64, padR = 90, padB = 56;
const W = padL + PL.length * CELL + padR, H = padT + HARV.length * CELL + padB;
function svg(title, sub, getColor, getVal, colorbar) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,Segoe UI,sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += `<text x="${padL}" y="26" font-size="17" font-weight="700" fill="#111">${title}</text>`;
  s += `<text x="${padL}" y="45" font-size="12" fill="#666">${sub}</text>`;
  // cells
  for (let ri = 0; ri < HARV.length; ri++) for (let ci = 0; ci < PL.length; ci++) {
    const h = HARV[ri], p = PL[ci], x = padL + ci * CELL, y = padT + ri * CELL;
    if (p > h) { // out of range (planters>harvesters)
      s += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#f0f0f0" stroke="#fff"/>`;
      s += `<line x1="${x}" y1="${y+CELL}" x2="${x+CELL}" y2="${y}" stroke="#ddd" stroke-width="1"/>`;
      continue;
    }
    const v = getVal(h, p);
    const fill = v == null ? '#cccccc' : getColor(v);
    s += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="#ffffff" stroke-width="0.6"/>`;
  }
  // axes labels
  s += `<text x="${padL + PL.length*CELL/2}" y="${H-16}" font-size="13" fill="#222" text-anchor="middle">planters (planting effort) →</text>`;
  s += `<text x="18" y="${padT + HARV.length*CELL/2}" font-size="13" fill="#222" text-anchor="middle" transform="rotate(-90 18 ${padT + HARV.length*CELL/2})">harvesters (predation) →</text>`;
  // col ticks (every other)
  for (let ci = 0; ci < PL.length; ci++) if (ci % 2 === 0) s += `<text x="${padL + ci*CELL + CELL/2}" y="${padT - 6}" font-size="10" fill="#555" text-anchor="middle">${PL[ci]}</text>`;
  // row ticks
  for (let ri = 0; ri < HARV.length; ri++) s += `<text x="${padL - 8}" y="${padT + ri*CELL + CELL/2 + 4}" font-size="10" fill="#555" text-anchor="end">${HARV[ri]}</text>`;
  // colorbar
  const cbx = padL + PL.length*CELL + 24, cbY = padT, cbH = HARV.length*CELL, cbW = 16, N = 60;
  for (let i = 0; i < N; i++) { const t = i / (N - 1); s += `<rect x="${cbx}" y="${cbY + cbH - (i+1)*cbH/N}" width="${cbW}" height="${cbH/N + 0.5}" fill="${colorbar(t)}"/>`; }
  s += `<rect x="${cbx}" y="${cbY}" width="${cbW}" height="${cbH}" fill="none" stroke="#aaa"/>`;
  for (const [t, lab] of colorbar.ticks) s += `<text x="${cbx + cbW + 5}" y="${cbY + cbH - t*cbH + 4}" font-size="10" fill="#444">${lab}</text>`;
  s += `</svg>`;
  return s;
}

// raw figure — color clamped at RAW_CLAMP so the extreme low-pop artifact cells
// (dome ~0.98) don't compress the scale and wash out the real planting band.
const RAW_CLAMP = 0.45;
const nOver = Object.values(raw).filter(v => v != null && v > RAW_CLAMP).length;
const cbRaw = t => seq(t); cbRaw.ticks = [[0,'0'],[0.5,(RAW_CLAMP/2).toFixed(2)],[1,'≥'+RAW_CLAMP.toFixed(2)]];
const rawSvg = svg('Domestication across predation × planting effort',
  `dome fraction (non-shattering seeds), full 150k-tick runs — color clamped at ${RAW_CLAMP} (${nOver} low-pop artifact cells saturate)`,
  v => seq(Math.min(v, RAW_CLAMP) / RAW_CLAMP), (h,p) => raw[`${h}_${p}`], cbRaw);
fs.writeFileSync(path.join(HERE, 'domestication_raw.svg'), rawSvg);

// corrected figure
const cbCorr = t => seq(t); cbCorr.ticks = [[0,'0'],[0.5,(corrMax/2).toFixed(2)],[1,'+'+corrMax.toFixed(2)]];
const corrSvg = svg('Planting-induced domestication (baseline-corrected)',
  'dome(h,p) − pure-harvester dome(h,0): the WT1 low-population artifact removed', v => div(v, corrMax), (h,p) => corr[`${h}_${p}`], cbCorr);
fs.writeFileSync(path.join(HERE, 'domestication_corrected.svg'), corrSvg);

// side-by-side panel (raw | corrected) — nest each panel SVG at an x offset
const GAP = 24;
const place = (s, dx) => s.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<svg x="${dx}"`);
const panels = `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * W + GAP}" height="${H}">`
  + `<rect width="${2 * W + GAP}" height="${H}" fill="#ffffff"/>`
  + place(rawSvg, 0) + place(corrSvg, W + GAP) + `</svg>`;
fs.writeFileSync(path.join(HERE, 'domestication_panels.svg'), panels);

console.log(`wrote domestication_raw.svg (max dome ${rawMax.toFixed(3)}), domestication_corrected.svg (max induced +${corrMax.toFixed(3)}), and domestication_panels.svg (side-by-side)`);
