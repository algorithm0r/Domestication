// worker.mjs — claim a run, execute it via headless.mjs, report stats + heartbeats.
// Loops until the queue is empty. One process per core (the launcher spawns N).
//
// Usage: node worker.mjs [coordinatorURL] [workerId] [outDir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COORD = process.argv[2] ?? 'http://localhost:8088';
const HOST = os.hostname();
const WID = process.argv[3] ?? `${HOST}-${process.pid}`;
const OUTDIR = process.argv[4] ?? path.join(HERE, 'results');
fs.mkdirSync(OUTDIR, { recursive: true });

let current = null, tick = 0, total = 0, pop = 0;

const getJSON = p => fetch(COORD + p).then(r => r.json());
const post = (p, obj) => fetch(COORD + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }).then(r => r.json()).catch(() => {});

setInterval(() => post('/heartbeat', { worker: WID, host: HOST, pid: process.pid, runId: current, tick, totalTicks: total, pop }), 15000);

function runHeadless(config, outfile) {
  return new Promise(resolve => {
    const ch = spawn('node', [path.join(HERE, 'headless.mjs'), JSON.stringify(config), outfile]);
    let out = '';
    ch.stdout.on('data', d => out += d);
    ch.stderr.on('data', d => { for (const line of d.toString().split('\n')) {
      const m = line.match(/PROGRESS (\d+) (\d+) (\d+)/); if (m) { tick = +m[1]; total = +m[2]; pop = +m[3]; }
    }});
    ch.on('close', code => { if (code === 0) { try { resolve(JSON.parse(out.trim())); } catch { resolve(null); } } else resolve(null); });
    ch.on('error', () => resolve(null));
  });
}

async function loop() {
  console.log(`[${WID}] -> ${COORD}`);
  while (true) {
    let claim;
    try { claim = await getJSON(`/claim?worker=${encodeURIComponent(WID)}&host=${encodeURIComponent(HOST)}`); }
    catch { await new Promise(r => setTimeout(r, 5000)); continue; }   // coordinator down: wait & retry
    if (claim.done) { console.log(`[${WID}] queue empty, done`); break; }
    current = claim.id; tick = 0; total = 0; pop = 0;
    const t0 = Date.now();
    const stats = await runHeadless(claim.config, path.join(OUTDIR, claim.id + '.json'));
    if (stats) { await post('/complete', { id: claim.id, worker: WID, host: HOST, stats }); console.log(`[${WID}] done ${claim.id} (${Math.round((Date.now()-t0)/1000)}s)`); }
    else { await post('/error', { id: claim.id, worker: WID, error: 'headless failed' }); console.log(`[${WID}] ERROR ${claim.id}`); }
    current = null;
  }
  process.exit(0);
}
loop();
