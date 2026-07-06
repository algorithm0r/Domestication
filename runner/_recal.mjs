// _recal.mjs — anchor recalibration grid on the fixed+reverted model. energy {10,20,30} × pop
// {70,80,90}, all-planting bottom anchor, N reps each. Runs headless.mjs children under a
// concurrency cap (workers are down, cores are free), computes dome per cell, prints a grid.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENERGY = (process.env.ENERGY || '10,20,30').split(',').map(Number);
const POP = (process.env.POP || '70,80,90').split(',').map(Number);
const REPS = parseInt(process.env.REPS || '5');
const EPOCH = parseInt(process.env.EPOCH || '150000');
const CONC = parseInt(process.env.CONC || '14');
const BASE = { epoch: EPOCH, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom', plantSelectionStrength: 0.2, plantSelectionChance: 1 };

// dome over the last third of the (seedPop/domeSeedPop) time series
function domeOf(d) {
  const sp = d.seedPop, ds = d.domeSeedPop, n = sp.length, st = Math.floor(n * 0.67);
  let dm = 0, c = 0;
  for (let i = st; i < n; i++) if (sp[i] > 0) { dm += ds[i] / sp[i]; c++; }
  return c ? dm / c : null;
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1)) : 0;

const TMP = path.join(HERE, '_recal_tmp');
fs.mkdirSync(TMP, { recursive: true });
const tasks = [];
// DOVETAIL order: rep-major, not setting-major. Emit rep 1 of every setting, then rep 2 of every
// setting, etc., so at any point coverage is balanced (n≈k across ALL settings) rather than some
// settings fully done and others untouched. Matters when there are more settings than slots.
const PLANTERS = process.env.PLANTERS != null ? +process.env.PLANTERS : null;  // null = all-plant (numPlanters=pop)
for (let r = 1; r <= REPS; r++) for (const e of ENERGY) for (const p of POP)
  tasks.push({ e, p, r, cfg: { ...BASE, metabolicThreshold: e, humanAddRate: p, numPlanters: PLANTERS != null ? PLANTERS : p } });

const results = {};                       // "pop_energy" -> [dome...]
let idx = 0, active = 0, done = 0;
const t0 = Date.now();

function runOne(t, cb) {
  const cf = path.join(TMP, `c_${t.p}_${t.e}_${t.r}.json`), of = path.join(TMP, `o_${t.p}_${t.e}_${t.r}.json`);
  fs.writeFileSync(cf, JSON.stringify(t.cfg));
  const ch = spawn('node', [path.join(HERE, 'headless.mjs'), '@' + cf, of], { stdio: 'ignore' });
  ch.on('exit', () => {
    let dome = null;
    try { dome = domeOf(JSON.parse(fs.readFileSync(of, 'utf8')).data); } catch {}
    (results[`${t.p}_${t.e}`] ||= []).push(dome);
    try { fs.unlinkSync(cf); fs.unlinkSync(of); } catch {}
    done++;
    console.error(`[${done}/${tasks.length}] pop${t.p}/e${t.e}/r${t.r} dome=${dome == null ? 'ERR' : dome.toFixed(3)} (${((Date.now()-t0)/1000).toFixed(0)}s)`);
    cb();
  });
}
function pump() {
  while (active < CONC && idx < tasks.length) { active++; runOne(tasks[idx++], () => { active--; if (done === tasks.length) finish(); else pump(); }); }
}
function finish() {
  const grid = {};
  for (const p of POP) for (const e of ENERGY) {
    const v = (results[`${p}_${e}`] || []).filter(x => x != null);
    grid[`${p}_${e}`] = { n: v.length, mean: v.length ? +mean(v).toFixed(3) : null, sd: v.length ? +sd(v).toFixed(3) : null };
  }
  console.error('\n=== DOME grid (mean ± sd, n=' + REPS + ', epoch ' + EPOCH + ') ===');
  console.error('pop\\energy    ' + ENERGY.map(e => ('e' + e).padStart(14)).join(''));
  let best = { mean: -1 };
  for (const p of POP) {
    let row = ('pop' + p).padEnd(12);
    for (const e of ENERGY) { const g = grid[`${p}_${e}`]; row += (g.mean == null ? 'ERR' : `${g.mean}±${g.sd}`).padStart(14);
      if (g.mean != null && g.mean > best.mean) best = { mean: g.mean, sd: g.sd, p, e }; }
    console.error(row);
  }
  console.error(`\npeak: pop${best.p} / energy${best.e} — dome ${best.mean}±${best.sd}`);
  const outfile = process.env.OUTFILE || 'recal-grid.json';
  fs.writeFileSync(path.join(HERE, outfile), JSON.stringify({ ENERGY, POP, REPS, EPOCH, PLANTERS, grid, best, raw: results }, null, 2));
  console.error('wrote ' + outfile + '  (total ' + ((Date.now()-t0)/1000/60).toFixed(1) + ' min)');
  process.exit(0);
}
console.error(`recal: ${tasks.length} runs (${POP.length}×${ENERGY.length} cells × ${REPS} reps), epoch ${EPOCH}, conc ${CONC}`);
pump();
