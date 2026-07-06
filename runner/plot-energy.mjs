// plot-energy.mjs — 1D energy optimum curve at pop80 (dome vs metabolicThreshold),
// with error bars on the replicated points (mt 15/20/25). Writes energy_curve.svg.
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
const mt2 = m => String(m).padStart(2, '0');
const REP = { 15: [], 20: [], 25: [] };
for (const mt of [15, 20, 25]) for (let r = 1; r <= 10; r++) { const v = dome(`erep_pop80_mt${mt2(mt)}_r${String(r).padStart(2,'0')}`); if (v != null) REP[mt].push(v); }
const stat = a => { const m = a.reduce((s,x)=>s+x,0)/a.length; return { m, sd: Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,a.length-1)) }; };

const MTS = [5,10,15,20,25,30,35,40,45,50,55,60];
const pts = MTS.map(mt => {
  if (REP[mt] && REP[mt].length) { const s = stat(REP[mt]); return { mt, v: s.m, sd: s.sd, n: REP[mt].length }; }
  return { mt, v: dome(`energy_pop80_mt${mt2(mt)}`), sd: 0, n: 1 };
}).filter(p => p.v != null);

// layout
const W = 720, H = 440, padL = 64, padR = 24, padT = 56, padB = 56;
const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
const xmin = 0, xmax = 60, ymin = 0, ymax = 0.55;
const X = mt => x0 + (mt - xmin) / (xmax - xmin) * (x1 - x0);
const Y = v => y0 + (v - ymin) / (ymax - ymin) * (y1 - y0);

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,Segoe UI,sans-serif">`;
s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
s += `<text x="${padL}" y="28" font-size="16" font-weight="700" fill="#111">Energy optimum at pop 80 (all-planting anchor)</text>`;
s += `<text x="${padL}" y="46" font-size="12" fill="#666">dome fraction vs metabolicThreshold; error bars = ±SD over 10 reps at mt 15/20/25.</text>`;
// gridlines + y ticks
for (let yv = 0; yv <= 0.5; yv += 0.1) { const y = Y(yv); s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#eee"/><text x="${x0-8}" y="${y+4}" font-size="11" fill="#666" text-anchor="end">${yv.toFixed(1)}</text>`; }
// x ticks
for (const mt of [0,10,20,30,40,50,60]) { const x = X(mt); s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0+4}" stroke="#999"/><text x="${x}" y="${y0+18}" font-size="11" fill="#666" text-anchor="middle">${mt}</text>`; }
s += `<text x="${(x0+x1)/2}" y="${H-12}" font-size="13" fill="#222" text-anchor="middle">metabolic energy (metabolicThreshold) →</text>`;
s += `<text x="16" y="${(y0+y1)/2}" font-size="13" fill="#222" text-anchor="middle" transform="rotate(-90 16 ${(y0+y1)/2})">dome fraction</text>`;
// default + peak markers
s += `<line x1="${X(30)}" y1="${y1}" x2="${X(30)}" y2="${y0}" stroke="#c66" stroke-dasharray="4 3"/><text x="${X(30)+4}" y="${y1+12}" font-size="11" fill="#c66">old default 30</text>`;
// line
s += `<polyline fill="none" stroke="#2a7" stroke-width="2" points="${pts.map(p=>`${X(p.mt).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}"/>`;
// error bars + points (filled = replicated/reliable, hollow = single run/noisy)
for (const p of pts) {
  const x = X(p.mt);
  if (p.sd > 0) { s += `<line x1="${x}" y1="${Y(p.v-p.sd)}" x2="${x}" y2="${Y(p.v+p.sd)}" stroke="#176" stroke-width="1.5"/>`;
    s += `<line x1="${x-3}" y1="${Y(p.v+p.sd)}" x2="${x+3}" y2="${Y(p.v+p.sd)}" stroke="#176"/><line x1="${x-3}" y1="${Y(p.v-p.sd)}" x2="${x+3}" y2="${Y(p.v-p.sd)}" stroke="#176"/>`; }
  s += p.n > 1 ? `<circle cx="${x}" cy="${Y(p.v)}" r="4" fill="#0a5" stroke="#fff"/>`
              : `<circle cx="${x}" cy="${Y(p.v)}" r="3.5" fill="#fff" stroke="#2a7" stroke-width="1.5"/>`;
}
// annotate the REPLICATED peak only (single runs are too noisy to claim a peak)
const reps = pts.filter(p => p.n > 1);
const peak = reps.reduce((a,b)=> b.v>a.v?b:a, reps[0]);
s += `<text x="${X(peak.mt)}" y="${Y(peak.v)-12}" font-size="12" font-weight="600" fill="#0a5" text-anchor="middle">replicated peak mt${peak.mt} = ${peak.v.toFixed(3)}</text>`;
// legend
s += `<circle cx="${x1-150}" cy="${y1+8}" r="4" fill="#0a5"/><text x="${x1-142}" y="${y1+12}" font-size="11" fill="#444">replicated (±SD)</text>`;
s += `<circle cx="${x1-150}" cy="${y1+26}" r="3.5" fill="#fff" stroke="#2a7" stroke-width="1.5"/><text x="${x1-142}" y="${y1+30}" font-size="11" fill="#444">single run (noisy)</text>`;
s += `</svg>`;
fs.writeFileSync(path.join(HERE, 'energy_curve.svg'), s);
console.log(`wrote energy_curve.svg (peak mt${peak.mt} = ${peak.v.toFixed(3)})`);
