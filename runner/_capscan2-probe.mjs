// _capscan2-probe.mjs — one headless run of the real model (vm sandbox, as in _basket-probe.mjs) with the
// shipped caps (basketSize 400, plantBasketSize 400). Records, for every planter trip after plantingTime:
// harvest-basket size on arrival home (max over the trip) and planting-basket size on departure.
// Answers ARTL-2026-0060.R1 comment RR2.6 (does either basket cap bind?). Driven by _capscan2-scan.mjs.
// Env: POP, MT, SAVED, EPOCH. Usage: node _capscan2-probe.mjs <out.json>
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const outFile = process.argv[2];
const EPOCH = parseInt(process.env.EPOCH || '100000');
const POP = parseInt(process.env.POP || '80');
const config = {
  epoch: EPOCH, humansAdded: Math.round(EPOCH / 4), plantingTime: Math.round(EPOCH / 2), predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom',
  humanAddRate: POP, numPlanters: POP, metabolicThreshold: parseInt(process.env.MT || '20'),
  plantSelectionStrength: parseFloat(process.env.SAVED || '0.2'), plantSelectionChance: 1,
};
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

const appendix = `
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun     = function () { this.run = 0; Object.assign(params, __CONFIG); };
Automata.prototype.applyPreset = function () { this.run = 0; Object.assign(params, __CONFIG); this.buildAutomata(); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {};

var H = { trips: 0, max: 0, sum: 0, ge300: 0, atCap: 0 };   // harvest basket, per trip home
var P = { deps: 0, max: 0, sum: 0, ge300: 0, atCap: 0 };    // planting basket, per departure
var __orig = Human.prototype.update;
Human.prototype.update = function () {
  var atBefore = !!(this.cell && this.cell.shelter);
  var carriedPlant = this.toPlant.length;
  if (!atBefore) this.__tripMax = Math.max(this.__tripMax || 0, this.seeds.length);
  __orig.call(this);
  var atAfter = !!(this.cell && this.cell.shelter);
  if (!atBefore) this.__tripMax = Math.max(this.__tripMax || 0, this.seeds.length);
  if (this.game.board.day <= params.plantingTime || !this.plants) return;
  if (atBefore && !atAfter) {                       // leaving home
    P.deps++; P.sum += carriedPlant; if (carriedPlant > P.max) P.max = carriedPlant;
    if (carriedPlant >= 300) P.ge300++; if (carriedPlant >= params.plantBasketSize) P.atCap++;
    this.__tripMax = 0;
  } else if (!atBefore && atAfter) {                // arriving home
    var m = this.__tripMax || 0;
    H.trips++; H.sum += m; if (m > H.max) H.max = m;
    if (m >= 300) H.ge300++; if (m >= params.basketSize) H.atCap++;
    this.__tripMax = 0;
  }
};
var board = new Automata();
for (var __k in __CONFIG) if (params[__k] !== __CONFIG[__k]) throw new Error('config not applied: ' + __k + '=' + params[__k] + ' want ' + __CONFIG[__k]);
for (var t = 1; t <= params.epoch; t++) board.update();
__OUT = { config: __CONFIG, basketSize: params.basketSize, plantBasketSize: params.plantBasketSize,
  harvest: { trips: H.trips, mean: H.trips ? +(H.sum / H.trips).toFixed(2) : 0, max: H.max, ge300: H.ge300, atCap: H.atCap },
  planting: { deps: P.deps, mean: P.deps ? +(P.sum / P.deps).toFixed(2) : 0, max: P.max, ge300: P.ge300, atCap: P.atCap },
  runMs: Math.round(__perf.now() - __t0) };
`;
const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = {
  console, document: { getElementById:()=>fakeEl, createElement:()=>fakeEl },
  window: { setTimeout:()=>{} }, navigator: {}, socket: null,
  Graph: class { constructor(){} draw(){} }, Histogram: class { constructor(){} draw(){} },
  __perf: performance, __t0: performance.now(), __CONFIG: config, __OUT: null,
};
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename: 'capscan2-probe.js' });
fs.writeFileSync(outFile, JSON.stringify(sandbox.__OUT, null, 2));
