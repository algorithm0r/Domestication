// gen-csvs.mjs [collection] [outdir] — regenerate the PAPER figure CSVs from the new Mongo data,
// replicating the old browser aggregator (graphs.js parseData): for each paper experiment number NN
// it pools that setting's replicates and SUMS each gene's 600×20 histogram (the Python figure scripts
// normalize per-column, so summing is correct), then serializes one tick per line, 20 comma-separated
// bucket counts — byte-identical in shape to the original csvs/rootsNN.csv. Also writes the population
// trajectory CSVs (population<NN>.csv: rows = avg total / wild / domesticated seed pop) for graph.py,
// and .txt copies of experiment 20 for hist_bottom.py (which reads .txt, 3 genes).
//
//   NN is the PAPER experiment number. The new runs don't carry a usable runName, so we assign NN here
//   by mapping each paper number to the corresponding new-batch setting id (below), verified against the
//   figure scripts' own title arrays. See runner README / fig-specs decoder for the gene-name crossing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const OUT = process.argv[3] || path.join(HERE, '..', 'data', 'journal', 'regen2026', 'csvs');

// paper experiment number -> new-batch setting id (agent-verified from the script title arrays)
const MAP = {
  '01': 'p01_nohumans', '02': 'p02_wt2_predation', '03': 'p03_wt3_plantrandom',
  '04': 'p04_harv_maxRoots', '05': 'p05_harv_maxFecundity', '06': 'p06_harv_maxWeight', '07': 'p07_harv_maxDispersal',
  '08': 'p08_harv_minRoots', '09': 'p09_harv_minFecundity', '10': 'p10_harv_minWeight', '11': 'p11_harv_minDispersal',
  '12': 'p12_plant_maxRoots', '13': 'p13_plant_maxFecundity', '14': 'p14_plant_maxWeight', '15': 'p15_plant_maxDispersal',
  '16': 'p16_plant_minRoots', '17': 'p17_plant_minFecundity', '18': 'p18_plant_minWeight', '19': 'p19_plant_minDispersal',
  '20': 'p20_plant_bottom', '21': 'p21_plant_top',
  '22': 'p22_sickle_noplant',                      // sickle (harvest non-shattering) with NO planting — for Sickles.pdf
  '40': 'lin_mingsp_pop80', '41': 'lin_maxgsp_pop80',   // lineage-age planting (freshest / oldest) — for the lineage figure
};
// gene prefix -> Mongo histogram field base (the code/data field names; see decoder). roots=Root Depth,
// seeds=Fecundity, weight=Seed Dispersal, disp=Abscission.
const GENES = [['roots', 'rootData'], ['seeds', 'seedData'], ['weight', 'weightData'], ['disp', 'dispersalData'], ['gsp', 'gspData']];
// harvested/planted event distributions: prefix -> field capitalization (harvested<Cap>Data / planted<Cap>Data)
const HP = [['roots', 'Root'], ['seeds', 'Seed'], ['weight', 'Weight'], ['disp', 'Dispersal'], ['gsp', 'Gsp']];
const TICKS = 600, BUCKETS = 20;

// Pull ONLY the fields the figures use. A null projection fetched the full doc — including the bulky
// lineage/divergence arrays (planted*/harvested*/gsp*) these figures never read — which made the pull
// slow and flaky (large payloads intermittently returned empty, silently skipping experiments and
// leaving stale CSVs). Restricting to these ~15 fields keeps the pull fast and reliable. Output-identical.
const PROJ = {
  seedPop: 1, wildSeedPop: 1, domeSeedPop: 1,
  rootData: 1, rootDataWild: 1, rootDataDomesticated: 1,
  seedData: 1, seedDataWild: 1, seedDataDomesticated: 1,
  weightData: 1, weightDataWild: 1, weightDataDomesticated: 1,
  dispersalData: 1, dispersalDataWild: 1, dispersalDataDomesticated: 1,
  gspData: 1, gspDataWild: 1, gspDataDomesticated: 1,
  plantedRootData: 1, plantedSeedData: 1, plantedWeightData: 1, plantedDispersalData: 1, plantedGspData: 1,
  harvestedRootData: 1, harvestedSeedData: 1, harvestedWeightData: 1, harvestedDispersalData: 1, harvestedGspData: 1,
};

// SUM a field's 600×20 histogram across all replicate docs (graphs.js combineHistograms)
function sumHist(docs, field) {
  const h = Array.from({ length: TICKS }, () => new Array(BUCKETS).fill(0));
  let any = false;
  for (const d of docs) { const g = d[field]; if (!g) continue; any = true;
    for (let t = 0; t < TICKS && t < g.length; t++) for (let b = 0; b < BUCKETS; b++) h[t][b] += (g[t]?.[b] || 0); }
  return any ? h : null;
}
function serializeHist(h) {   // one tick/line, 20 comma buckets; drop trailing all-zero rows (runs are 400
  let last = h.length;        // samples = 100k, but the field is padded to 600 — trimming ends the axis at 100k)
  while (last > 0 && h[last - 1].every(v => v === 0)) last--;
  return h.slice(0, last).map(row => row.join(',')).join('\n') + '\n';
}
// average a population-trajectory field across replicates
function avgSeries(docs, field) {
  const arrs = docs.map(d => d[field]).filter(Array.isArray); if (!arrs.length) return [];
  const L = Math.min(...arrs.map(a => a.length)); const o = new Array(L).fill(0);
  for (let t = 0; t < L; t++) { for (const a of arrs) o[t] += a[t]; o[t] /= arrs.length; }
  return o.slice(0, L - 1);                              // graphs.js drops the last sample
}

const socket = connect();
socket.on('connect_error', e => { console.log('gen-csvs connect_error', e.message); process.exit(1); });
socket.on('connect', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
  const keyById = {}; for (const s of settings) keyById[s.id] = settingKey(s.config);
  const write = (name, str) => fs.writeFileSync(path.join(OUT, name), str);
  let ok = 0, miss = [];
  for (const [NN, id] of Object.entries(MAP)) {
    const key = keyById[id]; if (!key) { miss.push(`${NN}:${id}(no key)`); continue; }
    // retry on empty: the bulky planted/harvested payloads intermittently return empty over the remote link,
    // which would silently skip the experiment. Retry a few times before giving up.
    let docs = [];
    for (let attempt = 0; attempt < 4 && !docs.length; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 800));
      docs = await findAll(socket, COLL, { setting: key }, PROJ);
    }
    if (!docs.length) { miss.push(`${NN}:${id}(no docs after retries)`); continue; }
    for (const [prefix, base] of GENES) {
      for (const [suffix, fieldSuffix] of [['', ''], ['wild', 'Wild'], ['dome', 'Domesticated']]) {
        const h = sumHist(docs, base + fieldSuffix); if (!h) continue;
        write(`${prefix}${NN}${suffix}.csv`, serializeHist(h));
      }
    }
    // harvested / planted event distributions (one distribution each, no wild/dome split)
    for (const [prefix, cap] of HP) {
      const pl = sumHist(docs, 'planted' + cap + 'Data'); if (pl) write(`plant_${prefix}${NN}.csv`, serializeHist(pl));
      const hv = sumHist(docs, 'harvested' + cap + 'Data'); if (hv) write(`harv_${prefix}${NN}.csv`, serializeHist(hv));
    }
    // population trajectory: total / wild / domesticated (rows) for graph.py
    const rows = [avgSeries(docs, 'seedPop'), avgSeries(docs, 'wildSeedPop'), avgSeries(docs, 'domeSeedPop')];
    write(`population${NN}.csv`, rows.map(r => r.join(',')).join('\n') + '\n');
    // experiment 20 also needs .txt (hist_bottom.py reads .txt from its own dir; write beside csvs + one up)
    if (NN === '20') for (const [prefix, base] of GENES) for (const [suffix, fs2] of [['', ''], ['wild', 'Wild'], ['dome', 'Domesticated']]) {
      const h = sumHist(docs, base + fs2); if (!h) continue; const s = serializeHist(h);
      write(`${prefix}${NN}${suffix}.txt`, s); fs.writeFileSync(path.join(OUT, '..', `${prefix}${NN}${suffix}.txt`), s);
    }
    ok++; process.stdout.write(`  ${NN}←${id} (n=${docs.length})`);
  }
  console.log(`\ngen-csvs: wrote ${ok}/${Object.keys(MAP).length} experiments to ${OUT}` + (miss.length ? `  | MISSING: ${miss.join(', ')}` : ''));
  socket.close(); process.exit(0);
});
// 180s was too short: a full pull of all ~24 experiments over the remote link takes ~5 min, and because
// JS orders integer-like keys ('10'..'22') BEFORE leading-zero keys ('01'..'09'), the control experiments
// (01-09) are processed LAST — so a premature timeout silently drops exactly the WT I/II/III conditions,
// leaving their CSVs stale while the figure still renders. Give it real headroom.
setTimeout(() => { console.log('gen-csvs: timeout'); process.exit(1); }, 900000);
