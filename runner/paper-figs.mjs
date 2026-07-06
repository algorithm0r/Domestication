// paper-figs.mjs [collection] — render the gene-distribution figures for the paper
// experiments (the histogram-over-time heatmaps). Groups replicates by settingKey (runName
// in the docs is unusable — always the default), sums each gene's 600×20 histogram across
// replicates, and renders 4 gene panels per experiment (value low→high bottom→top, time→right,
// per-column-normalized, log white→blue — matching the original histogram.js). Writes
// data/<collection>/paper_<id>.svg, and a manifest the figserver reads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey, MONGO_DB } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);
// 5 columns (gsp + 4 genes) × 3 rows (population / planted / harvested).
// field names: population = <base>Data ; planted/harvested = <prefix><Cap>Data
const COLS = [['gsp', 'Gsp', 'gsp / lineage'], ['weight', 'Weight', 'weight'], ['root', 'Root', 'root depth'], ['seed', 'Seed', 'fecundity'], ['dispersal', 'Dispersal', 'dispersal']];
const ROWS = [['pop', 'population — all'], ['popWild', 'population — wild'], ['popDome', 'population — domesticated'], ['planted', 'planted (sown)'], ['harvested', 'harvested (plucked)']];
function fieldName(type, popBase, cap) {
  if (type === 'popWild') return popBase + 'DataWild';
  if (type === 'popDome') return popBase + 'DataDomesticated';
  if (type === 'planted' || type === 'harvested') return type + cap + 'Data';
  return popBase + 'Data';   // population (all)
}

const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
// paper experiments (pNN_*) plus the lineage arms (lin_*) — both belong to the paper-experiment
// gene-distribution class (the lineage arms are a paper experiment, just added during the revision).
const paper = settings.filter(s => /^p\d\d_/.test(s.id) || /^lin_/.test(s.id)).map(s => ({ ...s, key: settingKey(s.config) }));

// histogram.js color: per-column proportion -> log white→blue
function color(prop) {
  let c = prop * 99 + 1; c = 511 - Math.floor(Math.log(c) / Math.log(100) * 512);
  if (c > 255) { c -= 256; return `rgb(${c},${c},255)`; } return `rgb(0,0,${Math.max(0, c)})`;
}
// render one gene panel: data = 600×20 summed histogram
function panel(data, label, x0, y0, W, H) {
  const T = data.length, B = 20, cols = Math.min(90, T), step = T / cols, cw = W / cols, ch = H / B;
  let s = '';
  for (let c = 0; c < cols; c++) {
    const t = Math.floor(c * step); const colSum = data[t].reduce((a, v) => a + v, 0) || 1;
    for (let b = 0; b < B; b++) {
      const prop = data[t][b] / colSum;
      s += `<rect x="${(x0 + c * cw).toFixed(1)}" y="${(y0 + (19 - b) * ch).toFixed(1)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${color(prop)}"/>`;
    }
  }
  s += `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="none" stroke="#999"/>`;
  s += `<text x="${x0 + W / 2}" y="${y0 + H + 14}" font-size="11" fill="#222" text-anchor="middle">${label}</text>`;
  return s;
}

const socket = connect();
socket.on('connect_error', e => { console.log('connect_error', e.message); process.exit(1); });
socket.on('connect', async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const manifest = [];
  for (const exp of paper) {
    const docs = await findAll(socket, COLL, { setting: exp.key }, null);   // full docs (need the histogram arrays)
    if (!docs.length) continue;
    // sum each field's 600×20 histogram over replicates (null-safe: pre-instrumentation docs lack planted/harvested)
    const sum = {};
    for (const [prefix] of ROWS) for (const [popBase, cap] of COLS) {
      const field = fieldName(prefix, popBase, cap);
      const acc = docs[0][field]?.map(row => row.slice()) || null; if (!acc) continue;
      for (let d = 1; d < docs.length; d++) { const g = docs[d][field]; if (!g) continue; for (let t = 0; t < acc.length; t++) for (let b = 0; b < 20; b++) acc[t][b] += (g[t]?.[b] || 0); }
      sum[field] = acc;
    }
    // layout: 3 rows (population / planted / harvested) × 5 cols (gsp + 4 genes)
    const PW = 180, PH = 62, padL = 96, padT = 50, gapX = 16, gapY = 22, padB = 26;
    const W = padL + COLS.length * (PW + gapX), H = padT + ROWS.length * (PH + gapY) + padB;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
    svg += `<text x="10" y="22" font-size="14" font-weight="700" fill="#111">${exp.id.replace(/_/g, ' ')}  <tspan font-weight="400" fill="#777">(n=${docs.length}, dome ${(docs.reduce((a, d) => a + (d.dome || 0), 0) / docs.length).toFixed(3)}) — value low→high bottom→top, time→right</tspan></text>`;
    COLS.forEach(([, , clbl], c) => { svg += `<text x="${padL + c * (PW + gapX) + PW / 2}" y="${padT - 6}" font-size="10" fill="#555" text-anchor="middle">${clbl}</text>`; });
    ROWS.forEach(([prefix, rlbl], r) => {
      const y = padT + r * (PH + gapY);
      svg += `<text x="8" y="${y + PH / 2}" font-size="10" font-weight="600" fill="#333">${rlbl}</text>`;
      COLS.forEach(([popBase, cap], c) => { const f = fieldName(prefix, popBase, cap); if (sum[f]) svg += panel(sum[f], '', padL + c * (PW + gapX), y, PW, PH); });
    });
    svg += `</svg>`;
    fs.writeFileSync(path.join(DIR, `paper_${exp.id}.svg`), svg);
    manifest.push({ id: exp.id, svg: `paper_${exp.id}.svg`, n: docs.length });
  }
  fs.writeFileSync(path.join(DIR, 'paper-manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`rendered ${manifest.length} paper-experiment figures (of ${paper.length}) from collection ${COLL}`);
  socket.close(); process.exit(0);
});
setTimeout(() => process.exit(1), 120000);
