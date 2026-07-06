// _flatpenalty-run.mjs — headless run (real model, vm sandbox) with the gene-sum PENALTY replaced
// by a flat constant, to remove the implicit "minimize every gene" selection pressure. Patches
// seed.js IN MEMORY only (disk untouched): the penalty sum becomes params.flatPenalty when that
// param is set, else the original sum. Captures the final gene-distribution histograms.
// Usage: node _flatpenalty-run.mjs @config.json out.json
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const cfgArg = process.argv[2] ?? '{}';
const outFile = process.argv[3] ?? 'out.json';
const config = JSON.parse(cfgArg.startsWith('@') ? fs.readFileSync(cfgArg.slice(1), 'utf8') : cfgArg);

// --- load model, patch seed.js penalty in memory ---
const srcOf = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let seedSrc = srcOf('seed.js');
const FROM = 'this.penalty = this.weight.value + this.deepRoots.value + this.fecundity.value + this.dispersal.value;';
const TO   = 'this.penalty = (params.flatPenalty != null ? params.flatPenalty : (this.weight.value + this.deepRoots.value + this.fecundity.value + this.dispersal.value));';
if (seedSrc.split(FROM).length - 1 !== 1) { console.error('PATCH FAIL: penalty line not found exactly once'); process.exit(2); }
seedSrc = seedSrc.replace(FROM, TO);
console.error('penalty patch applied (flatPenalty=' + (config.flatPenalty ?? 'unset->sum') + ')');
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + (f === 'seed.js' ? seedSrc : srcOf(f))).join('\n');

const appendix = `
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {
  __PAYLOAD = {
    params: JSON.parse(JSON.stringify(params)),
    seedPop: this.seedPop, wildSeedPop: this.wildSeedPop, domeSeedPop: this.domeSeedPop,
    weightData: this.weightData, rootData: this.rootData, seedData: this.seedData, dispersalData: this.dispersalData,
    weightDataWild: this.weightDataWild, rootDataWild: this.rootDataWild, seedDataWild: this.seedDataWild, dispersalDataWild: this.dispersalDataWild,
    weightDataDomesticated: this.weightDataDomesticated, rootDataDomesticated: this.rootsDataDomesticated,
    seedDataDomesticated: this.seedDataDomesticated, dispersalDataDomesticated: this.dispersalDataDomesticated,
  };
};
var board = new Automata();
var epoch = params.epoch, t0 = __perf.now();
for (var t = 1; t <= epoch; t++) { board.update(); if (t % 10000 === 0) console.error('t=' + t + ' seeds=' + gameEngine.board.seeds.length + ' humans=' + gameEngine.board.humans.length); }
board.dataMan.updateData();     // ensure a final snapshot
board.dataMan.logData();
__RESULT = { stats: { ticks: epoch, durationMs: Math.round(__perf.now()-t0), finalSeeds: gameEngine.board.seeds.length, humans: gameEngine.board.humans.length }, data: __PAYLOAD };
`;

const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = { console, document:{ getElementById:()=>fakeEl, createElement:()=>fakeEl }, window:{ setTimeout:()=>{} },
  navigator:{}, socket:null, Graph:class{constructor(){}draw(){}}, Histogram:class{constructor(){}draw(){}},
  __perf:performance, __CONFIG:config, __PAYLOAD:null, __RESULT:null };
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename: 'flatpenalty.js' });
fs.writeFileSync(outFile, JSON.stringify(sandbox.__RESULT));
process.stdout.write(JSON.stringify(sandbox.__RESULT.stats) + '\n');
