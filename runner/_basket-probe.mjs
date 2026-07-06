// _basket-probe.mjs — run ONE anchor config headless (real model, vm sandbox, like headless.mjs)
// and instrument how full each planter's planting basket (this.toPlant) is at the moment it
// LEAVES its shelter to sow. Records the basket size carried out on every shelter-departure by a
// planter after plantingTime (captured BEFORE that step's cultivate() drains one), as a histogram
// + per-10k-tick windows (to check stationarity). Writes a summary JSON; SNAP lines to stderr.
//
// Env overrides (for a fast smoke test only): EPOCH, HUMANSADDED, PLANTINGTIME.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const outFile = process.argv[2] ?? path.join(HERE, 'basket-probe.json');

// exact anchor (p20_plant_bottom), with optional env overrides for a quick smoke run
const config = {
  epoch: 150000, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom',
  humanAddRate: 80, numPlanters: 80, metabolicThreshold: 15,
  plantSelectionStrength: 0.2, plantSelectionChance: 1,
};
if (process.env.EPOCH) config.epoch = parseInt(process.env.EPOCH);
if (process.env.HUMANSADDED) config.humansAdded = parseInt(process.env.HUMANSADDED);
if (process.env.PLANTINGTIME) config.plantingTime = parseInt(process.env.PLANTINGTIME);
if (process.env.POP) { config.humanAddRate = parseInt(process.env.POP); config.numPlanters = parseInt(process.env.POP); }
if (process.env.MT) config.metabolicThreshold = parseInt(process.env.MT);
if (process.env.PLANTBASKET) config.plantBasketSize = parseInt(process.env.PLANTBASKET);

const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

const appendix = `
//==== runner + basket instrumentation ====
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {
  __PAYLOAD = { params: JSON.parse(JSON.stringify(params)), seedPop: this.seedPop, domeSeedPop: this.domeSeedPop };
};

// --- instrument shelter-departure basket fullness ---
var __CAP = params.plantBasketSize;                 // 50
var __hist = {};                                    // carried-size -> count (all planter departures, post-plantingTime)
var __dep = 0, __plantedDep = 0, __sum = 0, __sumPlanting = 0, __maxSeen = 0, __atCap = 0;
var __win = [], __w0 = { dep:0, pl:0, sum:0, sumP:0 };
var __origUpdate = Human.prototype.update;
Human.prototype.update = function () {
  var atBefore = !!(this.cell && this.cell.shelter);
  var carried = this.toPlant.length;                // basket size BEFORE this tick's move/cultivate
  __origUpdate.call(this);
  var atAfter = !!(this.cell && this.cell.shelter);
  if (this.plants && atBefore && !atAfter && this.game.board.day > params.plantingTime) {
    __dep++; __sum += carried; __hist[carried] = (__hist[carried]||0)+1;
    if (carried > __maxSeen) __maxSeen = carried;
    if (carried >= __CAP) __atCap++;
    if (carried > 0) { __plantedDep++; __sumPlanting += carried; }
  }
};

var board = new Automata();
__CAP = params.plantBasketSize;   // re-read AFTER the config override applies (plantBasketSize may be overridden)
var epoch = params.epoch;
var t0 = __perf.now();
for (var t = 1; t <= epoch; t++) {
  board.update();
  if (t % 10000 === 0) {
    var dDep = __dep - __w0.dep, dPl = __plantedDep - __w0.pl, dSum = __sum - __w0.sum, dSumP = __sumPlanting - __w0.sumP;
    var snap = { tick: t, departures: dDep, plantingDepartures: dPl,
      meanCarriedAll: dDep ? +(dSum/dDep).toFixed(2) : 0,
      meanCarriedWhenPlanting: dPl ? +(dSumP/dPl).toFixed(2) : 0,
      humans: gameEngine.board.humans.length };
    __win.push(snap); __w0 = { dep:__dep, pl:__plantedDep, sum:__sum, sumP:__sumPlanting };
    console.error('SNAP t=' + t + ' dep=' + dDep + ' plantingDep=' + dPl +
      ' meanAll=' + snap.meanCarriedAll + ' meanWhenPlanting=' + snap.meanCarriedWhenPlanting +
      ' humans=' + snap.humans);
  }
}
board.dataMan.logData();
var ms = __perf.now() - t0;
// dome over the last third of the seedPop/domeSeedPop time series (same as mongo.mjs domeOf)
var __sp = __PAYLOAD.seedPop, __dsp = __PAYLOAD.domeSeedPop, __n = __sp.length, __st = Math.floor(__n * 0.67), __dm = 0, __c = 0;
for (var __i = __st; __i < __n; __i++) if (__sp[__i] > 0) { __dm += __dsp[__i] / __sp[__i]; __c++; }
var __dome = __c ? __dm / __c : null;
__BASKET = {
  config: __CONFIG, cap: __CAP, scoopSize: params.scoopSize, basketSize: params.basketSize,
  dome: __dome != null ? +__dome.toFixed(4) : null,
  plantSelectionStrength: params.plantSelectionStrength,
  totals: { departures: __dep, plantingDepartures: __plantedDep,
    meanCarriedAll: __dep ? +(__sum/__dep).toFixed(3) : 0,
    meanCarriedWhenPlanting: __plantedDep ? +(__sumPlanting/__plantedDep).toFixed(3) : 0,
    fracDeparturesCarryingSeeds: __dep ? +(__plantedDep/__dep).toFixed(4) : 0,
    fracAtFullCap: __dep ? +(__atCap/__dep).toFixed(4) : 0, maxCarried: __maxSeen },
  histogram: __hist, windows: __win,
  runMs: Math.round(ms), finalHumans: gameEngine.board.humans.length,
  finalSeedPop: gameEngine.board.seeds.length,
};
`;

const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = {
  console,
  document: { getElementById:()=>fakeEl, createElement:()=>fakeEl },
  window: { setTimeout:()=>{} }, navigator: {}, socket: null,
  Graph: class { constructor(){} draw(){} }, Histogram: class { constructor(){} draw(){} },
  __perf: performance, __CONFIG: config, __PAYLOAD: null, __BASKET: null,
};
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename: 'basket-probe.js' });

fs.writeFileSync(outFile, JSON.stringify(sandbox.__BASKET, null, 2));
const b = sandbox.__BASKET;
process.stdout.write('\n=== BASKET PROBE SUMMARY ===\n' + JSON.stringify(b.totals, null, 2) + '\n');
