// launch.mjs — spawn N worker processes on this machine.
// Usage: node launch.mjs [coordinatorURL] [N] [outDir]
//   N default = floor(logicalCores/2)  (~physical cores; leaves the box usable)
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COORD = process.argv[2] ?? 'http://localhost:8088';
const LOGICAL = os.cpus().length;
const N = parseInt(process.argv[3] ?? String(Math.max(1, Math.floor(LOGICAL / 2))));
const OUTDIR = process.argv[4] ?? path.join(HERE, 'results');
const START = parseInt(process.env.WSTART ?? '0');   // worker-id offset, so extra launches don't collide ids

console.log(`${os.hostname()}: ${LOGICAL} logical cores -> launching ${N} workers (w${START}..w${START + N - 1}) to ${COORD}`);
const procs = [];
for (let i = 0; i < N; i++) {
  procs.push(spawn('node', [path.join(HERE, 'worker.mjs'), COORD, `${os.hostname()}-w${START + i}`, OUTDIR], { stdio: 'inherit' }));
}
let alive = N;
procs.forEach(w => w.on('close', () => { if (--alive === 0) { console.log('all workers exited'); process.exit(0); } }));
process.on('SIGINT', () => { procs.forEach(w => w.kill()); process.exit(0); });
