// _capscan2-scan.mjs — run _capscan2-probe.mjs over the metabolic-threshold sweep (mt 20-100 x pop 10/80/160,
// bottom-of-basket planting, seeds saved 0.2) plus seeds saved 0.5 and 1.0 at mt 20, CONC at a time; print a
// table and write capscan2.json (gitignored; the table is recorded in CHANGELOG.md, 2026-10-11).
// ~25 min on 20 cores at EPOCH=100000.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '_capscan2_out'); fs.mkdirSync(OUT, { recursive: true });
const CONC = parseInt(process.env.CONC || '12');
const EPOCH = process.env.EPOCH || '100000';
const jobs = [];
for (const mt of [20, 30, 40, 50, 60, 70, 80, 90, 100]) for (const pop of [10, 80, 160]) jobs.push({ pop, mt, saved: 0.2 });
for (const saved of [0.5, 1.0]) for (const pop of [10, 80, 160]) jobs.push({ pop, mt: 20, saved });
if (process.env.SMOKE) jobs.splice(1);

let idx = 0, active = 0, done = 0;
const key = j => `p${j.pop}_mt${j.mt}_s${j.saved}`;
function run(j, cb) {
  const env = { ...process.env, POP: String(j.pop), MT: String(j.mt), SAVED: String(j.saved), EPOCH };
  const ch = spawn('node', [path.join(HERE, '_capscan2-probe.mjs'), path.join(OUT, key(j) + '.json')], { stdio: ['ignore', 'ignore', 'inherit'], env });
  ch.on('exit', code => { done++; console.error(`[${done}/${jobs.length}] ${key(j)} exit ${code}`); cb(); });
}
function pump() {
  while (active < CONC && idx < jobs.length) { active++; run(jobs[idx++], () => { active--; done === jobs.length ? finish() : pump(); }); }
}
function finish() {
  const rows = jobs.map(j => { try { return { ...j, ...JSON.parse(fs.readFileSync(path.join(OUT, key(j) + '.json'), 'utf8')) }; } catch { return { ...j, error: true }; } });
  console.log('pop  mt   saved | harvest trips  mean  max  >=300  atCap | planting deps  mean  max  >=300  atCap');
  for (const r of rows) {
    if (r.error) { console.log(`${key(r)} ERROR`); continue; }
    const h = r.harvest, p = r.planting;
    console.log(`${String(r.pop).padEnd(4)} ${String(r.mt).padEnd(4)} ${String(r.saved).padEnd(5)} | ${String(h.trips).padStart(13)} ${String(h.mean).padStart(5)} ${String(h.max).padStart(4)} ${String(h.ge300).padStart(6)} ${String(h.atCap).padStart(6)} | ${String(p.deps).padStart(13)} ${String(p.mean).padStart(5)} ${String(p.max).padStart(4)} ${String(p.ge300).padStart(6)} ${String(p.atCap).padStart(6)}`);
  }
  fs.writeFileSync(path.join(HERE, 'capscan2.json'), JSON.stringify(rows, null, 2));
}
pump();
