// headless.mjs — run ONE simulation config to completion, headless.
// Loads the real model (incl. the real DataManager so the output matches the
// browser/DB data format), applies a params override, runs to params.epoch,
// and writes { stats, data } to an output file. Portable (Node, no DOM).
//
// Usage: node headless.mjs <config.json|@inline-json> <out.json>
//   config.json: a JSON object of params overrides (e.g. {"humanAddRate":100,...})
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');                       // model files live one level up
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];

const cfgArg = process.argv[2] ?? '{}';
const outFile = process.argv[3] ?? 'out.json';
const config = JSON.parse(cfgArg.startsWith('@') ? fs.readFileSync(cfgArg.slice(1), 'utf8') : cfgArg);

// --- model source (concatenated so class/const share one scope) ---
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

// --- appendix: drive the run and capture the DataManager payload ---
const appendix = `
//==== runner ====
var gameEngine = new GameEngine();

// neutralize the browser-driven config path; apply our config instead
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};   // no canvas headless

// capture logData's payload to a global instead of emitting to a socket
DataManager.prototype.logData = function () {
  __PAYLOAD = {
    params: JSON.parse(JSON.stringify(params)),
    seedPop: this.seedPop, humanPop: this.humanPop,
    wildSeedPop: this.wildSeedPop, domeSeedPop: this.domeSeedPop,
    weightData: this.weightData, rootData: this.rootData, seedData: this.seedData, dispersalData: this.dispersalData,
    weightDataWild: this.weightDataWild, rootDataWild: this.rootDataWild, seedDataWild: this.seedDataWild, dispersalDataWild: this.dispersalDataWild,
    weightDataDomesticated: this.weightDataDomesticated, rootDataDomesticated: this.rootsDataDomesticated,
    seedDataDomesticated: this.seedDataDomesticated, dispersalDataDomesticated: this.dispersalDataDomesticated,
  };
};

var board = new Automata();
var epoch = params.epoch;
var t0 = __perf.now();
for (var t = 1; t <= epoch; t++) {                    // run to (not past) epoch -> no auto-reset
  board.update();
  if (t % 2500 === 0) console.error('PROGRESS ' + t + ' ' + epoch + ' ' + gameEngine.board.seeds.length);
}
board.dataMan.logData();                               // capture final time-series
var ms = __perf.now() - t0;
__RESULT = {
  stats: { ticks: epoch, durationMs: Math.round(ms), ticksPerSec: Math.round(epoch / (ms/1000)),
           finalPop: gameEngine.board.seeds.length, humans: gameEngine.board.humans.length },
  data: __PAYLOAD,
};
`;

// --- sandbox: stub the browser bits; real performance for timing ---
const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = {
  console,
  document: { getElementById:()=>fakeEl, createElement:()=>fakeEl },
  window: { setTimeout:()=>{} },
  navigator: {},
  socket: null,
  Graph: class { constructor(){} draw(){} },         // viz stubs (no canvas)
  Histogram: class { constructor(){} draw(){} },
  __perf: performance,
  __CONFIG: config,
  __PAYLOAD: null,
  __RESULT: null,
};
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename: 'headless.js' });

fs.writeFileSync(outFile, JSON.stringify(sandbox.__RESULT));
process.stdout.write(JSON.stringify(sandbox.__RESULT.stats) + '\n');   // worker reads stats from stdout
