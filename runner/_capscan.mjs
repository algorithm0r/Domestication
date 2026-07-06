// _capscan.mjs — how close does per-trip basket carry get to the plantBasketSize=50 cap across
// energy? Runs the basket probe with plantBasketSize=400 (un-truncated, reveals the true recovery
// ceiling) for each mt at a fixed pop, then reports max carry, mean, and the fraction of departures
// that WOULD hit the real 50-cap (carried >= 50). Standalone headless children under a conc cap.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MTS = (process.env.MTS || '10,20,30,40,50').split(',').map(Number);
const POP = process.env.POP || '80';
const EPOCH = process.env.EPOCH || '70000';
const CONC = parseInt(process.env.CONC || '5');
const REALCAP = 50;

const TMP = path.join(HERE, '_capscan_tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const results = {};
let idx = 0, active = 0, done = 0;
function runOne(mt, cb) {
  const of = path.join(TMP, `mt${mt}.json`);
  const env = { ...process.env, POP, MT: String(mt), PLANTBASKET: '400', EPOCH };
  const ch = spawn('node', [path.join(HERE, '_basket-probe.mjs'), of], { stdio: 'ignore', env });
  ch.on('exit', () => {
    try {
      const b = JSON.parse(fs.readFileSync(of, 'utf8'));
      const h = b.histogram, tot = Object.values(h).reduce((a, v) => a + v, 0) || 1;
      let atOrOver = 0; for (const k of Object.keys(h)) if (+k >= REALCAP) atOrOver += h[k];
      results[mt] = { mean: b.totals.meanCarriedWhenPlanting, max: b.totals.maxCarried,
        fracHitCap: +(atOrOver / tot).toFixed(4), dome: b.dome };
    } catch { results[mt] = { error: true }; }
    done++; console.error(`[${done}/${MTS.length}] mt${mt} done`);
    cb();
  });
}
function pump() { while (active < CONC && idx < MTS.length) { active++; runOne(MTS[idx++], () => { active--; if (done === MTS.length) finish(); else pump(); }); } }
function finish() {
  console.error(`\n=== basket-cap contact vs energy (pop ${POP}, plantBasketSize=400, real cap=${REALCAP}) ===`);
  console.error('mt    meanCarry   maxCarry   frac>=50(cap contact)   dome');
  for (const mt of MTS) { const r = results[mt] || {}; if (r.error) { console.error(`mt${mt}  ERROR`); continue; }
    console.error(`mt${String(mt).padEnd(3)} ${String(r.mean).padStart(8)} ${String(r.max).padStart(9)} ${String((100*r.fracHitCap).toFixed(1)+'%').padStart(16)} ${String(r.dome).padStart(12)}`); }
  fs.writeFileSync(path.join(HERE, 'capscan.json'), JSON.stringify({ POP, results }, null, 2));
  process.exit(0);
}
console.error(`capscan: mt ${MTS.join(',')} at pop ${POP}, plantBasketSize=400, epoch ${EPOCH}, conc ${CONC}`);
pump();
