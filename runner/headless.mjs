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

// neutralize the browser-driven config path; apply our config instead.
// Both hooks are overridden because the Automata constructor has called each in turn: it called
// reset() -> nextRun() before the web-interface overhaul and applyPreset(0) after. Overriding only
// one lets a constructor change silently drop __CONFIG and run the defaults instead of the config.
// NB applyPreset builds the board itself (reset() did that for nextRun), so the override must too.
loadParameters = function () {};
Automata.prototype.nextRun     = function () { this.run = 0; Object.assign(params, __CONFIG); };
Automata.prototype.applyPreset = function () { this.run = 0; Object.assign(params, __CONFIG); this.buildAutomata(); };
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
    gspData: this.gspData, gspDataWild: this.gspDataWild, gspDataDomesticated: this.gspDataDomesticated,
    plantedWeightData: this.plantedWeightData, plantedRootData: this.plantedRootData, plantedSeedData: this.plantedSeedData,
    plantedDispersalData: this.plantedDispersalData, plantedGspData: this.plantedGspData, plantCountData: this.plantCountData,
    harvestedWeightData: this.harvestedWeightData, harvestedRootData: this.harvestedRootData, harvestedSeedData: this.harvestedSeedData,
    harvestedDispersalData: this.harvestedDispersalData, harvestedGspData: this.harvestedGspData, harvestCountData: this.harvestCountData,
  };
};

var board = new Automata();

// Fail loudly if the config never reached params. The constructor's config hook has moved once
// already (reset()->nextRun() became applyPreset()), and when it moves the run does not error --
// it silently executes the default preset, which is indistinguishable from a real result in the DB.
for (var __k in __CONFIG) {
  var __want = __CONFIG[__k];
  if ((typeof __want !== 'object' || __want === null) && params[__k] !== __want) {
    throw new Error('headless: config key "' + __k + '" not applied (want ' + JSON.stringify(__want) +
                    ', got ' + JSON.stringify(params[__k]) + ') -- the Automata config hook moved again');
  }
}

var epoch = params.epoch;
var t0 = __perf.now();

if (params.artificial) {
  // ---- ARTIFICIAL regime: PERFECT humans (continuous, overlapping turnover) ----
  // Simulates ideal farmers replacing the old walking/limited humans. Every plant grows to maturity
  // AS NORMAL; the instant it matures a perfect human plucks ALL its seeds into a PERSISTENT store
  // (so no plant is left to shatter). Then EVERY tick, every empty cell-slot (up to cellCapacity) is
  // refilled from the store, planting the MOST RECENTLY harvested seeds first (LIFO). Order each tick:
  // grow -> harvest -> plant. Each mature plant yields several seeds but frees only one slot, so the
  // store runs a surplus; that surplus is SAVED tick to tick (LIFO leaves it at the bottom) and the
  // board stays at max capacity — no boom/bust, no walking, unlimited perfect planting.
  //   burnin>0        : run the native model (natural dispersal, no humans) for burnin ticks first.
  //   burnPredation>0 : during burn-in only, run natural predation (=> genuine shattering wild type).
  // board.update() still drives growth + DataManager sampling, so the stored payload is DB-identical.
  var B = gameEngine.board, DIM = params.dimension;
  var burnin = params.burnin || 0;
  var STORE_CAP = params.storeCap || 40000;                   // bound the store (keeps memory + grain fresh)
  var SUPPRESS = false;                                        // natural dispersal off during the perfect-human phase
  var __origSpread = Seed.prototype.spreadSeeds;
  Seed.prototype.spreadSeeds = function () { if (SUPPRESS) return; return __origSpread.call(this); };
  if (params.burnPredation > 0) params.predationChance = params.burnPredation;   // predation ON for burn-in

  var store = [];                                             // persistent granary of harvested gene-records
  var cells = [];                                             // fixed random fill order over non-shelter cells
  for (var ci0 = 0; ci0 < DIM; ci0++) for (var cj0 = 0; cj0 < DIM; cj0++) { var cc = B.board[ci0][cj0]; if (!cc.shelter) cells.push(cc); }
  for (var sa = cells.length - 1; sa > 0; sa--) { var sb = randomInt(sa + 1); var tmp = cells[sa]; cells[sa] = cells[sb]; cells[sb] = tmp; }

  function _harvest() {                                        // pluck ALL seeds off every mature plant -> store, free the cell
    var surv = [];
    for (var k = 0; k < B.seeds.length; k++) {
      var s = B.seeds[k];
      if (s.isMature() && s.seeds > 0) {
        for (var g = 0; g < s.seeds; g++) store.push({
          weight:   { value: s.weight.value },   deepRoots: { value: s.deepRoots.value },
          fecundity:{ value: s.fecundity.value }, dispersal:{ value: s.dispersal.value },
          gsp: (typeof s.gsp === 'number' ? s.gsp : 9999) });
        s.cell.removeSeed(s);                                  // pull off the board WITHOUT spreadSeeds
      } else surv.push(s);
    }
    B.seeds = surv;
    if (store.length > STORE_CAP) store.splice(0, store.length - (STORE_CAP >> 1));   // over cap: batch-drop oldest SAVED grain to half-cap (amortized O(1); LIFO never reaches these)
  }
  function _fill() {                                           // fill every empty cell-slot, planting the MOST RECENTLY harvested seeds first (LIFO)
    for (var ci = 0; ci < cells.length && store.length > 0; ci++) {
      var c = cells[ci];
      while (c.seeds.length < params.cellCapacity && store.length > 0) {
        var rec = store.pop();                                 // LIFO: newest grain planted first; surplus stays saved at the bottom for lean ticks
        rec.cell = c; c.addSeed(rec, 0, true);                 // planted -> gsp=0, one mutation
      }
    }
  }

  for (var t = 1; t <= epoch; t++) {
    if (t === burnin + 1) { SUPPRESS = true; params.predationChance = 0; }   // perfect-human phase begins; kill predation
    board.update();                                            // plants grow (and die) as normal
    if (t > burnin) { _harvest(); _fill(); }                   // harvest -> plant, every tick
    if (t % 2500 === 0) console.error('PROGRESS ' + t + ' ' + epoch + ' ' + B.seeds.length);
  }
} else {
  for (var t = 1; t <= epoch; t++) {                    // run to (not past) epoch -> no auto-reset
    board.update();
    if (t % 2500 === 0) console.error('PROGRESS ' + t + ' ' + epoch + ' ' + gameEngine.board.seeds.length);
  }
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
