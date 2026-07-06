// heatmap-cross.mjs <saved|selective> — annotated viridis heatmap for a param×pop cross.
// Baseline-corrected (dome minus the energy-20 pure-harvester baseline base_e20_pop{pop})
// when those baselines exist; otherwise raw, with the mode shown in the subtitle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const POPS = [40, 60, 80, 100, 120, 140];
const pad = v => String(Math.round(v * 100)).padStart(3, '0');
const TYPES = {
  saved:     { vals: [0.05,0.10,0.15,0.20,0.30,0.50], id: (p,v)=>`saved_pop${p}_s${pad(v)}`,     axis: 'saved% (plantSelectionStrength)', title: 'saved%' },
  selective: { vals: [0,0.25,0.50,0.75,1.0],          id: (p,v)=>`selective_pop${p}_c${pad(v)}`, axis: 'selective% (plantSelectionChance)', title: 'selective%' },
  energy:    { vals: [10,20,30,40,50,60], id: (p,v)=>`energy_pop${p}_mt${String(v).padStart(2,'0')}`, axis: 'metabolic energy (metabolicThreshold)', title: 'energy', raw: true, int: true },
};
const which = process.argv[2] || 'saved';
const T = TYPES[which]; if (!T) { console.error('usage: heatmap-cross.mjs <saved|selective|energy>'); process.exit(1); }
const vlabel = v => T.int ? String(v) : v.toFixed(2);

function dome(id) {
  const f = path.join(HERE, 'results', id + '.json');
  if (!fs.existsSync(f)) return null;
  try { const o = JSON.parse(fs.readFileSync(f, 'utf8')), d = o.data, n = d.seedPop.length, st = Math.floor(n * 0.67);
    let dm = 0, c = 0; for (let i = st; i < n; i++) if (d.seedPop[i] > 0) { dm += d.domeSeedPop[i] / d.seedPop[i]; c++; }
    return c ? dm / c : null; } catch { return null; }
}
const lerp = (a,b,t) => a + (b-a)*t;
const hex = (r,g,b) => '#' + [r,g,b].map(x => Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
function viridis(t) { const s=[[68,1,84],[59,82,139],[33,144,141],[93,201,99],[253,231,37]];
  t=Math.max(0,Math.min(1,t)); const x=t*(s.length-1),i=Math.floor(x),f=x-i,a=s[i],b=s[Math.min(i+1,s.length-1)];
  return [lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)]; }

// baselines (energy-20 pure-harvester); corrected only if ALL present and type isn't raw
const base = {}; let haveBase = !T.raw;
for (const p of POPS) { const b = dome(`base_e20_pop${p}`); base[p] = b; if (b == null) haveBase = false; }

const grid = {}; let max = 0;
for (const p of POPS) for (const v of T.vals) {
  const raw = dome(T.id(p, v));
  const val = raw == null ? null : (haveBase ? raw - base[p] : raw);
  grid[`${p}_${v}`] = val;
  if (val != null && val > max) max = val;
}
if (max <= 0) max = 0.001;

const CW = 84, CH = 46, padL = 78, padT = 80, padR = 96, padB = 56;
const W = padL + T.vals.length*CW + padR, H = padT + POPS.length*CH + padB;
const mode = haveBase ? 'baseline-corrected (planting-induced)' : 'RAW — correction pending energy-20 baselines';
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,Segoe UI,sans-serif">`;
s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
s += `<text x="${padL}" y="30" font-size="17" font-weight="700" fill="#111">Domestication vs ${T.title} × population</text>`;
const fixed = which==='energy' ? 'all-planting, saved 0.20, 100% selective' : which==='selective' ? 'energy 20, all-planting, saved 0.20' : 'energy 20, all-planting, 100% selective';
s += `<text x="${padL}" y="50" font-size="12" fill="#666">dome fraction, ${mode}. ${fixed}.</text>`;
for (let ri=0; ri<POPS.length; ri++) for (let ci=0; ci<T.vals.length; ci++) {
  const p=POPS[ri], v=T.vals[ci], val=grid[`${p}_${v}`], x=padL+ci*CW, y=padT+ri*CH;
  const [r,g,b] = val==null ? [204,204,204] : viridis(Math.max(0,val)/max);
  s += `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="${hex(r,g,b)}" stroke="#fff" stroke-width="1"/>`;
  if (val!=null) { const lum=0.299*r+0.587*g+0.114*b;
    s += `<text x="${x+CW/2}" y="${y+CH/2+4}" font-size="13" text-anchor="middle" fill="${lum>140?'#111':'#fff'}">${val.toFixed(3)}</text>`; }
}
s += `<text x="${padL+T.vals.length*CW/2}" y="${H-16}" font-size="13" fill="#222" text-anchor="middle">${T.axis} →</text>`;
s += `<text x="20" y="${padT+POPS.length*CH/2}" font-size="13" fill="#222" text-anchor="middle" transform="rotate(-90 20 ${padT+POPS.length*CH/2})">population (harvesters) →</text>`;
T.vals.forEach((v,ci)=> s+=`<text x="${padL+ci*CW+CW/2}" y="${padT-8}" font-size="12" fill="#555" text-anchor="middle">${vlabel(v)}</text>`);
POPS.forEach((p,ri)=> s+=`<text x="${padL-10}" y="${padT+ri*CH+CH/2+4}" font-size="12" fill="#555" text-anchor="end">${p}</text>`);
const cbx=padL+T.vals.length*CW+26, cbY=padT, cbH=POPS.length*CH, cbW=16, N=60;
for (let i=0;i<N;i++){const [r,g,b]=viridis(i/(N-1)); s+=`<rect x="${cbx}" y="${cbY+cbH-(i+1)*cbH/N}" width="${cbW}" height="${cbH/N+0.5}" fill="${hex(r,g,b)}"/>`;}
s += `<rect x="${cbx}" y="${cbY}" width="${cbW}" height="${cbH}" fill="none" stroke="#aaa"/>`;
[[0,'0'],[0.5,(max/2).toFixed(2)],[1,max.toFixed(2)]].forEach(([t,l])=> s+=`<text x="${cbx+cbW+5}" y="${cbY+cbH-t*cbH+4}" font-size="11" fill="#444">${l}</text>`);
s += `</svg>`;
fs.writeFileSync(path.join(HERE, `cross_${which}.svg`), s);
console.log(`wrote cross_${which}.svg (${mode}, max ${max.toFixed(3)})`);
