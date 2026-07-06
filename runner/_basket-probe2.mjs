// _basket-probe2.mjs — like _basket-probe.mjs but (a) optionally PATCHES the hunger/metabolism
// asymmetry in-memory (never touches human.js on disk) and (b) also records WHICH drive triggers
// each homecoming. Runs the anchor (p20_plant_bottom) headless to epoch (default 70000).
//
//   PATCH=1  -> hunger rests to 0 like thirst/tired, and thirst+hunger are clamped at 0.
//   PATCH=0  -> stock model (baseline).
// Usage: node _basket-probe2.mjs <out.json>     (env: PATCH, EPOCH)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const outFile = process.argv[2] ?? path.join(HERE, 'basket-probe2.json');
const PATCH = process.env.PATCH === '1';

const config = {
  epoch: parseInt(process.env.EPOCH || '70000'), humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom',
  humanAddRate: 80, numPlanters: 80, metabolicThreshold: 15,
  plantSelectionStrength: 0.2, plantSelectionChance: 1,
};

// --- load model; optionally patch human.js source IN MEMORY (disk untouched) ---
let human = fs.readFileSync(path.join(REPO, 'human.js'), 'utf8');
if (PATCH) {
  const subs = [
    // 1) hunger rests to 0 like the other two
    ['this.hunger > -params.metabolicThreshold', 'this.hunger > 0'],
    // 2) clamp thirst decrement at 0
    ['this.thirst -= val;', 'this.thirst = Math.max(this.thirst - val, 0);'],
    // 3) clamp hunger decrement at 0
    ['this.hunger -= params.seedsDiffMetabolism ? seed.energy : 1;',
     'this.hunger = Math.max(this.hunger - (params.seedsDiffMetabolism ? seed.energy : 1), 0);'],
  ];
  for (const [from, to] of subs) {
    const n = human.split(from).length - 1;
    if (n !== 1) { console.error(`PATCH FAIL: expected exactly 1 match for\n  ${from}\ngot ${n}`); process.exit(2); }
    human = human.replace(from, to);
  }
  console.error('PATCH applied: 3/3 substitutions OK');
}
const srcByFile = f => f === 'human.js' ? human : fs.readFileSync(path.join(REPO, f), 'utf8');
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + srcByFile(f)).join('\n');

const appendix = `
//==== runner + instrumentation ====
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {
  __PAYLOAD = { seedPop: this.seedPop, domeSeedPop: this.domeSeedPop };
};

var __CAP = params.plantBasketSize;                 // not overridden by config; safe to read now
var __hist = {}, __dep = 0, __plantedDep = 0, __sum = 0, __sumP = 0, __atCap = 0, __maxSeen = 0;

// basket fullness at shelter-departure (planter, post-plantingTime)
var __origUpdate = Human.prototype.update;
Human.prototype.update = function () {
  var atBefore = !!(this.cell && this.cell.shelter);
  var carried = this.toPlant.length;
  __origUpdate.call(this);
  var atAfter = !!(this.cell && this.cell.shelter);
  if (this.plants && atBefore && !atAfter && this.game.board.day > params.plantingTime) {
    __dep++; __sum += carried; __hist[carried] = (__hist[carried]||0)+1;
    if (carried > __maxSeen) __maxSeen = carried;
    if (carried >= __CAP) __atCap++;
    if (carried > 0) { __plantedDep++; __sumP += carried; }
  }
};

// which drive triggers each homecoming (rising edge of spendEnergy==true)
var __home = { total:0, thirst:0, hunger:0, tired:0, hungerSum:0 };
var __origSpend = Human.prototype.spendEnergy;
Human.prototype.spendEnergy = function () {
  var MT = params.metabolicThreshold;               // live value (config applied by now)
  var before = (this.thirst > MT || this.hunger > MT || this.tired > MT);
  var r = __origSpend.call(this);
  if (r && !before && this.game.board.day > params.plantingTime) {
    __home.total++;
    if (this.thirst > MT) __home.thirst++;
    else if (this.hunger > MT) __home.hunger++;
    else if (this.tired > MT) __home.tired++;
    __home.hungerSum += this.hunger;
  }
  return r;
};

var board = new Automata();
var epoch = params.epoch, t0 = __perf.now();
for (var t = 1; t <= epoch; t++) {
  board.update();
  if (t % 10000 === 0) console.error('SNAP t=' + t + ' dep=' + __dep + ' meanCarried=' +
    (__dep?(__sum/__dep).toFixed(2):0) + ' home[thirst/hunger/tired]=' +
    __home.thirst + '/' + __home.hunger + '/' + __home.tired + ' humans=' + gameEngine.board.humans.length);
}
board.dataMan.logData();
// dome over last third (same as mongo.mjs domeOf)
var sp = __PAYLOAD.seedPop, dsp = __PAYLOAD.domeSeedPop, N = sp.length, st = Math.floor(N*0.67), dm=0, c=0;
for (var i=st;i<N;i++) if (sp[i]>0){ dm += dsp[i]/sp[i]; c++; }
__RESULT = {
  patched: __PATCH, cap: __CAP, scoopSize: params.scoopSize, metabolicThreshold: params.metabolicThreshold, epoch: epoch,
  basket: { departures: __dep, meanCarried: __dep?+(__sum/__dep).toFixed(3):0,
    meanWhenPlanting: __plantedDep?+(__sumP/__plantedDep).toFixed(3):0,
    fracAtFullCap: __dep?+(__atCap/__dep).toFixed(4):0, maxCarried: __maxSeen, histogram: __hist },
  homecoming: { total: __home.total,
    thirstPct: __home.total?+(100*__home.thirst/__home.total).toFixed(1):0,
    hungerPct: __home.total?+(100*__home.hunger/__home.total).toFixed(1):0,
    tiredPct: __home.total?+(100*__home.tired/__home.total).toFixed(1):0,
    meanHungerAtHome: __home.total?+(__home.hungerSum/__home.total).toFixed(2):0 },
  dome: c?+(dm/c).toFixed(4):null, runMs: Math.round(__perf.now()-t0), finalHumans: gameEngine.board.humans.length,
};
`;

const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = {
  console, document:{ getElementById:()=>fakeEl, createElement:()=>fakeEl }, window:{ setTimeout:()=>{} },
  navigator:{}, socket:null, Graph:class{constructor(){}draw(){}}, Histogram:class{constructor(){}draw(){}},
  __perf:performance, __CONFIG:config, __PATCH:PATCH, __PAYLOAD:null, __RESULT:null,
};
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename: 'basket-probe2.js' });

fs.writeFileSync(outFile, JSON.stringify(sandbox.__RESULT, null, 2));
const r = sandbox.__RESULT;
process.stdout.write('\n=== ' + (r.patched?'PATCHED':'BASELINE') + ' (mt=' + r.metabolicThreshold + ', epoch ' + r.epoch + ') ===\n');
process.stdout.write('basket: ' + JSON.stringify({ ...r.basket, histogram: undefined }) + '\n');
process.stdout.write('homecoming: ' + JSON.stringify(r.homecoming) + '\n');
process.stdout.write('dome: ' + r.dome + '\n');
