// compose-figs.mjs [collection] — render the PAPER distribution figures (compose_<id>.svg) as
// gene-rows × experiment/variant-columns grids of histogram-over-time panels, with PAPER gene labels
// (the code field names are crossed — see fig-specs.mjs / README decoder). Reads the raw runs from
// Mongo, sums each needed field's 600×20 histogram over replicates, and lays out each figure per its
// spec. Writes data/<coll>/compose_<id>.svg + compose-manifest.json (id, file, fig, title, caption, n).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';
import { SPECS, GENES } from './fig-specs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const DIR = path.join(HERE, 'data', COLL);

// id -> settingKey (and settings list for diagonal resolution by id substring)
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const keyById = {}; for (const s of settings) keyById[s.id] = settingKey(s.config);
const idsContaining = tok => settings.filter(s => s.id.includes(tok)).map(s => s.id);

// resolve a column+gene to an experiment id
function resolveExp(col, geneKey) {
  if (col.exp) return col.exp;
  if (col.mode) {                                  // diagonal: find id containing `${mode}${idtok}`
    const tok = col.mode + GENES[geneKey].idtok;
    const hits = idsContaining(tok);
    return hits[0] || null;
  }
  return null;
}
const fieldName = (variant, g) => {
  const G = GENES[g];
  if (variant === 'wild') return G.base + 'DataWild';
  if (variant === 'dome') return G.base + 'DataDomesticated';
  if (variant === 'planted') return 'planted' + G.cap + 'Data';
  if (variant === 'harvested') return 'harvested' + G.cap + 'Data';
  return G.base + 'Data';                          // pop (all)
};

// histogram.js per-column log color (white→blue) — matches the original paper figures
function color(prop) { let c = prop * 99 + 1; c = 511 - Math.floor(Math.log(c) / Math.log(100) * 512);
  if (c > 255) { c -= 256; return `rgb(${c},${c},255)`; } return `rgb(0,0,${Math.max(0, c)})`; }
// one gene panel: 600×20 summed histogram, per-column normalized, downsampled to <=90 cols
function panel(data, x0, y0, W, H) {
  const T = data.length, B = 20, cols = Math.min(90, T), step = T / cols, cw = W / cols, ch = H / B;
  let s = '';
  for (let c = 0; c < cols; c++) {
    const t = Math.floor(c * step), colSum = data[t].reduce((a, v) => a + v, 0) || 1;
    for (let b = 0; b < B; b++)
      s += `<rect x="${(x0 + c * cw).toFixed(1)}" y="${(y0 + (19 - b) * ch).toFixed(1)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${color(data[t][b] / colSum)}"/>`;
  }
  return s + `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="none" stroke="#999" stroke-width="0.6"/>`;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// gather every experiment id used by any spec; pull once, sum the pop/wild/dome fields we need
function neededExps() {
  const set = new Set();
  for (const spec of SPECS) for (const col of spec.cols) for (const g of spec.genes) {
    const id = resolveExp(col, g); if (id) set.add(id);
  }
  return [...set];
}

const socket = connect();
socket.on('connect_error', e => { console.log('compose connect_error', e.message); process.exit(1); });
socket.on('connect', async () => {
  fs.mkdirSync(DIR, { recursive: true });
  // pull + sum each needed experiment's histograms (variant fields for the 4 genes)
  const summed = {}, nById = {};                   // id -> { field -> 600×20 }, id -> replicate count
  for (const id of neededExps()) {
    const key = keyById[id]; if (!key) { console.log('  ! no settingKey for', id); continue; }
    const docs = await findAll(socket, COLL, { setting: key }, null);
    nById[id] = docs.length;
    if (!docs.length) { console.log('  ! no docs for', id); continue; }
    const acc = {};
    const fields = [];
    for (const g of Object.keys(GENES)) for (const v of ['pop', 'wild', 'dome']) fields.push(fieldName(v, g));
    for (const f of fields) {
      const base = docs[0][f]?.map(r => r.slice()) || null; if (!base) continue;
      for (let d = 1; d < docs.length; d++) { const arr = docs[d][f]; if (!arr) continue;
        for (let t = 0; t < base.length; t++) for (let b = 0; b < 20; b++) base[t][b] += (arr[t]?.[b] || 0); }
      acc[f] = base;
    }
    summed[id] = acc;
  }

  const manifest = [];
  for (const spec of SPECS) {
    const genes = spec.genes, cols = spec.cols;
    const PW = 190, PH = 60, padL = 118, padT = 88, gapX = 14, gapY = 12, padB = 20;
    const W = padL + cols.length * (PW + gapX) - gapX + 22;
    const H = padT + genes.length * (PH + gapY) - gapY + padB;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="system-ui,Segoe UI,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
    svg += `<text x="12" y="24" font-size="15" font-weight="700" fill="#111">${esc(spec.title)}</text>`;
    svg += `<text x="12" y="41" font-size="10.5" fill="#888">value low→high bottom→top · time→right · pooled over replicates</text>`;
    // column headers (+ per-column n if a fixed experiment)
    cols.forEach((col, ci) => {
      const x = padL + ci * (PW + gapX) + PW / 2;
      const n = col.exp ? nById[col.exp] : null;
      svg += `<text x="${x}" y="${padT - 22}" font-size="11" font-weight="600" fill="#333" text-anchor="middle">${esc(col.label)}</text>`;
      if (n != null) svg += `<text x="${x}" y="${padT - 9}" font-size="9.5" fill="#999" text-anchor="middle">n=${n}</text>`;
    });
    // gene rows
    genes.forEach((g, ri) => {
      const y = padT + ri * (PH + gapY);
      svg += `<text x="${padL - 10}" y="${y + PH / 2 + 3}" font-size="11" font-weight="600" fill="#222" text-anchor="end">${esc(GENES[g].paper)}</text>`;
      cols.forEach((col, ci) => {
        const x = padL + ci * (PW + gapX);
        const id = resolveExp(col, g);
        const f = fieldName(col.variant || 'pop', g);
        const data = id && summed[id] && summed[id][f];
        if (data) svg += panel(data, x, y, PW, PH);
        else svg += `<rect x="${x}" y="${y}" width="${PW}" height="${PH}" fill="#f4f4f4" stroke="#ddd"/><text x="${x + PW / 2}" y="${y + PH / 2}" font-size="9" fill="#aaa" text-anchor="middle">no data</text>`;
        if (col.highlight === g) svg += `<rect x="${x - 1.5}" y="${y - 1.5}" width="${PW + 3}" height="${PH + 3}" fill="none" stroke="#d21" stroke-width="2"/>`;
      });
    });
    svg += `</svg>`;
    fs.writeFileSync(path.join(DIR, `compose_${spec.id}.svg`), svg);
    const ns = cols.map(c => c.exp ? nById[c.exp] : null).filter(x => x != null);
    manifest.push({ id: spec.id, file: `compose_${spec.id}.svg`, fig: spec.fig, title: spec.title, caption: spec.caption, n: ns.length ? Math.min(...ns) : null });
    console.log(`  ✓ compose_${spec.id}.svg  (${genes.length}×${cols.length})`);
  }
  fs.writeFileSync(path.join(DIR, 'compose-manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`rendered ${manifest.length} composed paper figures -> ${DIR}`);
  socket.close(); process.exit(0);
});
setTimeout(() => { console.log('compose: timeout'); process.exit(1); }, 120000);
