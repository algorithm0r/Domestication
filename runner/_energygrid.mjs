// _energygrid.mjs — energy×pop grid on the fixed model, with a numPlanters=0 baseline per cell,
// to see the corrected (plant − baseline) surface and locate the anchor peak/plateau.
// mt{10,20,30,40,50} × pop{10..100}, all-plant + baseline, N reps. Dovetailed, baselines-first.
// Standalone headless (in-memory, no coordinator/DB). Writes energygrid.json + prints the surface.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENERGY = [10, 20, 30, 40, 50];
const POP = []; for (let p = 10; p <= 100; p += 10) POP.push(p);
const REPS = parseInt(process.env.REPS || '3');
const EPOCH = parseInt(process.env.EPOCH || '100000');
const CONC = parseInt(process.env.CONC || '16');
const BASE = { epoch: EPOCH, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom', plantSelectionStrength: 0.2, plantSelectionChance: 1 };

function domeOf(d) {
  const sp = d.seedPop, ds = d.domeSeedPop, n = sp.length, st = Math.floor(n * 0.67);
  let dm = 0, c = 0;
  for (let i = st; i < n; i++) if (sp[i] > 0) { dm += ds[i] / sp[i]; c++; }
  return c ? dm / c : null;
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1)) : 0;

const TMP = path.join(HERE, '_egrid_tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// DOVETAIL, baselines-first: for each rep, emit every cell's baseline (np=0), then every cell's plant (np=pop).
const tasks = [];
for (let r = 1; r <= REPS; r++) {
  for (const e of ENERGY) for (const p of POP) tasks.push({ e, p, r, np: 0,  kind: 'base' });
  for (const e of ENERGY) for (const p of POP) tasks.push({ e, p, r, np: p,  kind: 'plant' });
}

const results = {};                       // "e_p_kind" -> [dome...]
let idx = 0, active = 0, done = 0;
const t0 = Date.now();
function runOne(t, cb) {
  const cfg = { ...BASE, metabolicThreshold: t.e, humanAddRate: t.p, numPlanters: t.np };
  const cf = path.join(TMP, `c_${t.kind}_${t.e}_${t.p}_${t.r}.json`), of = path.join(TMP, `o_${t.kind}_${t.e}_${t.p}_${t.r}.json`);
  fs.writeFileSync(cf, JSON.stringify(cfg));
  const ch = spawn('node', [path.join(HERE, 'headless.mjs'), '@' + cf, of], { stdio: 'ignore' });
  ch.on('exit', () => {
    let dome = null;
    try { dome = domeOf(JSON.parse(fs.readFileSync(of, 'utf8')).data); } catch {}
    (results[`${t.e}_${t.p}_${t.kind}`] ||= []).push(dome);
    try { fs.unlinkSync(cf); fs.unlinkSync(of); } catch {}
    done++;
    if (done % 10 === 0 || done === tasks.length)
      console.error(`[${done}/${tasks.length}] ${((Date.now()-t0)/1000/60).toFixed(1)}min`);
    cb();
  });
}
function pump() { while (active < CONC && idx < tasks.length) { active++; runOne(tasks[idx++], () => { active--; if (done === tasks.length) finish(); else pump(); }); } }

function finish() {
  const cell = (e, p, k) => (results[`${e}_${p}_${k}`] || []).filter(x => x != null);
  const out = { ENERGY, POP, REPS, EPOCH, plant: {}, base: {}, corrected: {} };
  console.error('\n=== CORRECTED dome (plant − baseline), mean, n=' + REPS + ', epoch ' + EPOCH + ' ===');
  console.error('pop\\mt   ' + ENERGY.map(e => ('mt' + e).padStart(9)).join(''));
  let best = { c: -9 };
  for (const p of POP) {
    let row = ('pop' + p).padEnd(8);
    for (const e of ENERGY) {
      const pl = cell(e, p, 'plant'), bs = cell(e, p, 'base');
      const pm = pl.length ? mean(pl) : null, bm = bs.length ? mean(bs) : null;
      const c = (pm != null && bm != null) ? +(pm - bm).toFixed(3) : null;
      out.plant[`${e}_${p}`] = pm == null ? null : +pm.toFixed(3);
      out.base[`${e}_${p}`] = bm == null ? null : +bm.toFixed(3);
      out.corrected[`${e}_${p}`] = c;
      row += (c == null ? 'ERR' : c.toFixed(3)).padStart(9);
      if (c != null && c > best.c) best = { c, e, p };
    }
    console.error(row);
  }
  out.best = best;
  console.error(`\ncorrected peak: pop${best.p} / mt${best.e} — +${best.c}`);
  fs.writeFileSync(path.join(HERE, 'energygrid.json'), JSON.stringify(out, null, 2));
  console.error('wrote energygrid.json  (total ' + ((Date.now()-t0)/1000/60).toFixed(1) + ' min)');
  process.exit(0);
}
console.error(`energy grid: ${tasks.length} runs (${ENERGY.length}×${POP.length} cells × 2 [plant+base] × ${REPS} reps), epoch ${EPOCH}, conc ${CONC}`);
pump();
