// regen-paper.mjs [collection] — one-shot regeneration of the FINAL paper figure set from clean data,
// into data/<coll>/final/ (PNG previews + manifest) for the figserver /paper tab and for dropping into
// the .tex. Pipeline: gen-csvs.mjs (Mongo -> CSVs) -> the original matplotlib scripts (PDF) -> pdftoppm
// (PNG); plus the sweep + collapse SVGs rasterized via resvg. Skips figures whose inputs aren't ready
// (e.g. sickles until its run lands). Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const REGEN = path.resolve(HERE, '..', 'data', 'journal', 'regen2026');
const CSVS = path.join(REGEN, 'csvs');
const DATA = path.join(HERE, 'data', COLL);
const OUT = path.join(DATA, 'final');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(REGEN, 'imgs'), { recursive: true });

const sh = (cmd, args, opts = {}) => new Promise((res) => {
  const ch = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'ignore'], ...opts });
  ch.on('close', code => res(code)); ch.on('error', () => res(-1));
});
const has = f => fs.existsSync(path.join(CSVS, f));
const py = { env: { ...process.env, MPLBACKEND: 'Agg' }, cwd: REGEN };

// 300 dpi: the histogram panels have 200–400 time-columns; at low dpi the column edges beat against
// the pixel grid and moiré into vertical stripes. Oversampling removes it. (The vector PDF is unaffected.)
const pdfToPng = (pdf, id) => sh('pdftoppm', ['-png', '-singlefile', '-r', '300', path.join(REGEN, pdf), path.join(OUT, id)]);

async function run() {
  process.stdout.write('regen-paper: gen-csvs…\n');
  await sh('node', [path.join(HERE, 'gen-csvs.mjs'), COLL], { cwd: HERE });

  // distribution figures (built AFTER gen-csvs so sickle CSVs, if the run landed, are present):
  // [id, title, caption, script, args, producedPdf(relative to REGEN)]
  const csvReady = has('roots22.csv');   // sickle run landed?
  const PY = [
    ['control', 'Wild Types', 'Natural selection (I), predation (II), and non-selective planting (III). Abscission shifts to shattering once humans harvest.', 'hist_control.py', ['01', '02', '03'], 'control.pdf'],
    ['prelims', 'Genes Under Selection', 'Selective harvesting drives a trait down; selective planting drives it up. Rows = genes; first column = Wild Type III baseline, then harvest/plant × max/min.', 'hist_prelims.py', [], 'prelims.pdf'],
    ['domesticated', 'Domesticated Variants', 'The domesticated (non-shattering) subpopulation from the five selective-planting experiments that produced one; red box = directly-selected gene.', 'hist_dome.py', ['12', '13', '14', '18', '19'], 'imgs/domesticationSyndrome.pdf'],
    ['wild', 'Wild Variants', 'Three selective-planting experiments that stayed wild; selecting the shattering (max abscission) trait is indistinguishable from wild, so no isolation begins.', 'hist_wild.py', ['16', '17', '15'], 'imgs/wildVariants.pdf'],
    ['split', 'Domestication Syndrome (split)', 'Planting non-shattering seeds (min abscission, experiment 19) split into total / wild / domesticated across the four genes — the domestication-syndrome detail figure.', 'hist_split.py', ['19', 'split.pdf'], 'split.pdf'],
    ['sickles', 'Sickle Theory', 'Harvesting non-shattering seeds (a sickle) does not domesticate: vs Wild Type II (no planting) and Wild Type III (+ random planting), the sickle barely shifts the population from wild.', 'hist_sickles.py', ['02', '22', '03', '11'], 'sickles.pdf'],
    ['first', 'Unintended Selective Planting', 'Replanting the first-harvested seeds domesticates via geographic selection: total / wild / domesticated.', 'hist_first.py', ['20', 'First.pdf'], 'First.pdf'],
    ['lineage', 'Lineage-Age Planting', 'Planting the freshest lineage (no trait selection) reproductively isolates and domesticates the crop: total / wild / domesticated — the isolation mechanism in isolation.', 'hist_first.py', ['40', 'lineage.pdf', 'lineage'], 'lineage.pdf'],
  ].filter(row => row[0] !== 'sickles' || csvReady);

  const manifest = { group: {}, figs: [] };
  for (const [id, title, caption, script, args, pdf] of PY) {
    const code = await sh('python', [script, ...args], py);
    const src = path.join(REGEN, pdf);
    if (code === 0 && fs.existsSync(src)) { await pdfToPng(pdf, id);
      manifest.figs.push({ group: 'dist', id, title, caption, png: `${id}.png` });
      process.stdout.write(`  ✓ ${id}\n`);
    } else process.stdout.write(`  ✗ ${id} (script ${code}, pdf ${fs.existsSync(src)})\n`);
  }

  // mega sensitivity panel — the paper's fig:sweep (mega.pdf). gen-megafig-data.mjs pulls the gsp distributions
  // once and computes corrected dome + TV + mean-gap per cell across all four sweeps, caching every cell in
  // megafig-cache.json; heat_mega.py 'dome' renders the single domestication row at 7in. Runs BEFORE the collapse
  // so its cache warms the identical sweep-cell pull the collapse would otherwise repeat (collapse then only
  // pulls the ~12 discrete anchors). Supersedes the old four separate sweep_*.pdf panels for the paper.
  await sh('node', [path.join(HERE, 'gen-megafig-data.mjs'), COLL], { cwd: HERE });
  const mjson = path.join(DATA, 'megafig-data.json');
  if (fs.existsSync(mjson)) {
    const code = await sh('python', ['heat_mega.py', mjson, path.join(REGEN, 'mega.pdf'), 'dome'], py);
    if (code === 0 && fs.existsSync(path.join(REGEN, 'mega.pdf'))) { await pdfToPng('mega.pdf', 'mega');
      manifest.figs.push({ group: 'sweep', id: 'mega', title: 'Sensitivity — domestication across four sweeps', caption: 'Corrected domestication across human population × each swept parameter: planting effort, seeds saved, planting selectivity, and metabolic energy. All panels share the population axis. The paper\'s sensitivity figure (mega.pdf).', png: 'mega.png' });
      process.stdout.write('  ✓ mega\n');
    }
  }
  // collapse (two-lens) — the paper's fig:collapse (collapse_twolens.pdf). _gspcollapse.mjs reuses the megafig
  // cache for the swept cells (so it only pulls the ~12 discrete anchors), and exports each cell's TV distance
  // AND signed mean-gap plus the anchors; collapse_lens.py renders both lenses side by side at \textwidth (7in).
  await sh('node', [path.join(HERE, '_gspcollapse.mjs'), COLL], { cwd: HERE });
  const cjson = path.join(DATA, 'gspcollapse-data.json');
  if (fs.existsSync(cjson)) {
    const code = await sh('python', ['collapse_lens.py', cjson, path.join(REGEN, 'collapse_twolens.pdf'), 'both', '7.0'], py);
    if (code === 0 && fs.existsSync(path.join(REGEN, 'collapse_twolens.pdf'))) { await pdfToPng('collapse_twolens.pdf', 'collapse');
      manifest.figs.push({ group: 'collapse', id: 'collapse', title: 'The collapse — domestication under two divergence lenses', caption: 'Each grey point is one swept setting: corrected domestication against lineage divergence under two lenses — left, total-variation distance between the planted and harvested lineage-age distributions; right, the signed mean lineage-age gap (harvested − planted). Black line is the pooled binned mean. Dark diamonds are the discrete trait-planting experiments; red and blue stars are the youngest- and oldest-lineage planting runs.', png: 'collapse.png' });
      process.stdout.write('  ✓ collapse (two-lens)\n');
    }
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  process.stdout.write(`regen-paper: wrote ${manifest.figs.length} figures -> ${OUT}${csvReady ? '' : '  (sickles pending its run)'}\n`);
}
run();
