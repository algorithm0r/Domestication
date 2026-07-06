// diag-lineage.mjs — instrument the 'planted' lineage arm and trace the planted flag.
// Verifies the rule chain (sow -> grain flagged at pluck -> retained -> only-flagged replanted)
// and logs, over time, what fraction of PLANTED seeds carried the flag (vs bootstrap padding),
// what fraction of harvested grain was flagged, and the standing sown-plant fraction.
// Usage: node diag-lineage.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

// time-compressed but real dynamics (planting from tick 10k). Mode selects the arm; the planted
// flag is SET and tracked in every mode (only the move() filter is gated by plantLineage).
const MODE = process.argv[2] || 'planted';
const FULL = process.argv[3] === 'full';
const MODES = {
  planted: { plantStrategy:'random', plantSelectionChance:0, plantLineage:'planted' },  // binary flag-only selection
  natural: { plantStrategy:'random', plantSelectionChance:0, plantLineage:'natural' },  // binary negative control
  wt3:     { plantStrategy:'random', plantSelectionChance:0, plantLineage:'off'     },  // random planting, NO filter (= p03 baseline)
  anchor:  { plantStrategy:'bottom', plantSelectionChance:1, plantLineage:'off'     },  // the domesticating anchor, NO filter
  gsp:     { plantStrategy:'mingsp', plantSelectionChance:1, plantLineage:'off'     },  // select lowest gens-since-planted
  maxgsp:  { plantStrategy:'gsp',    plantSelectionChance:1, plantLineage:'off'     },  // select highest (deep-wild) — negative control
};
const timing = FULL ? { epoch:150000, humansAdded:25000, plantingTime:50000 }   // production length
                    : { epoch:70000,  humansAdded:5000,  plantingTime:10000 };  // time-compressed
const config = { humanAddRate:80, numPlanters:80, metabolicThreshold:15, plantSelectionStrength:0.2,
  harvestStrategy:'random', predationChance:0, ...timing, ...MODES[MODE] };
console.log('MODE = ' + MODE + (FULL ? ' [FULL 150k]' : ' [compressed 70k]') + '  (plantStrategy=' + config.plantStrategy + ', selective=' + config.plantSelectionChance + ', plantLineage=' + config.plantLineage + ')');

const appendix = `
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {};

// ---- instrumentation ----
var S = { plantTot:0, plantFlag:0, pluckTot:0, pluckFlag:0, plantGsp:0 };  // windowed counters
var origCult = Human.prototype.cultivate;
Human.prototype.cultivate = function () {
  var seed = this.toPlant[0];
  if (seed) { S.plantTot++; if (seed.fromPlanted) S.plantFlag++; S.plantGsp += (seed.gsp||0); }  // flag + gens-since-planted of the sown seed
  return origCult.call(this);
};
var origPluck = Seed.prototype.pluckSeeds;
Seed.prototype.pluckSeeds = function () {
  var list = origPluck.call(this);
  for (var i=0;i<list.length;i++){ S.pluckTot++; if (list[i].fromPlanted) S.pluckFlag++; } // grain off a sown plant?
  return list;
};

// ---- rule-chain unit trace (deterministic, before the big run) ----
var trace = [];
(function(){
  var board = new Automata();
  var cell = gameEngine.board.board[25][25];
  // a hand-sown seed
  cell.addSeed({ cell: cell }, 2, true);                 // planted=true path (cultivate uses this)
  var sown = cell.dormantSeeds[cell.dormantSeeds.length-1].seed;
  trace.push('sown seed.planted = ' + sown.planted + ' (expect true)');
  sown.growth = sown.threshold; sown.seeds = 5;          // force it mature with grain "on its head"
  var grain = sown.pluckSeeds();                         // pluck it
  trace.push('grain off sown plant fromPlanted = ' + (grain[0] && grain[0].fromPlanted) + ' (expect true)');
  // a natural seed for contrast
  cell.addSeed({ cell: cell }, 0);                       // natural (no planted arg)
  var nat = cell.dormantSeeds[cell.dormantSeeds.length-1].seed;
  nat.growth = nat.threshold; nat.seeds = 5;
  var ngrain = nat.pluckSeeds();
  trace.push('natural seed.planted = ' + nat.planted + ' (expect false)');
  trace.push('grain off natural plant fromPlanted = ' + (ngrain[0] && ngrain[0].fromPlanted) + ' (expect false)');
})();

// ---- the run, with periodic snapshots ----
var board = new Automata();
var rows = [];
var epoch = params.epoch;
for (var t = 1; t <= epoch; t++) {
  board.update();
  if (t > params.plantingTime && t % 5000 === 0) {
    var seeds = gameEngine.board.seeds;
    var sown = 0, dome = 0, lowGsp = 0, dLow = 0, nLow = 0, dHigh = 0, nHigh = 0;
    for (var i=0;i<seeds.length;i++){
      if (seeds[i].planted) sown++;
      if (seeds[i].dispersal.value < params.wildDomesticThreshold) dome++;
      if (seeds[i].gsp < 50) { lowGsp++; dLow += seeds[i].dispersal.value; nLow++; }   // recently-planted lineage
      else { dHigh += seeds[i].dispersal.value; nHigh++; }                              // deep-wild lineage
    }
    rows.push({ t:t, pop:seeds.length, sownFrac:+(sown/Math.max(1,seeds.length)).toFixed(3),
      domeFrac:+(dome/Math.max(1,seeds.length)).toFixed(3),
      lowGspFrac:+(lowGsp/Math.max(1,seeds.length)).toFixed(3),
      dispLow: nLow? +(dLow/nLow).toFixed(3): null, dispHigh: nHigh? +(dHigh/nHigh).toFixed(3): null,
      plantGsp: S.plantTot? +(S.plantGsp/S.plantTot).toFixed(1): null,
      plantFlagPct: S.plantTot? +(100*S.plantFlag/S.plantTot).toFixed(1):0 });
    S = { plantTot:0, plantFlag:0, pluckTot:0, pluckFlag:0, plantGsp:0 };           // reset window
  }
}
__RESULT = { trace: trace, rows: rows };
`;

const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = { console, document:{ getElementById:()=>fakeEl, createElement:()=>fakeEl }, window:{ setTimeout:()=>{} },
  navigator:{}, socket:null, Graph:class{constructor(){}draw(){}}, Histogram:class{constructor(){}draw(){}},
  __perf:performance, __CONFIG:config, __RESULT:null };
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename:'diag.js' });

const R = sandbox.__RESULT;
console.log('=== rule-chain trace ===');
R.trace.forEach(l => console.log('  ' + l));
console.log('\\n=== time series ===');
console.log('  tick    pop  sownFrac domeFrac lowGspFrac | dispersal(lowGsp) dispersal(highGsp) | meanPlantedGsp %flagged');
for (const r of R.rows)
  console.log('  ' + String(r.t).padStart(6) + ' ' + String(r.pop).padStart(5)
    + '   ' + String(r.sownFrac).padStart(5) + '   ' + String(r.domeFrac).padStart(5) + '    ' + String(r.lowGspFrac).padStart(5)
    + '   |   ' + String(r.dispLow).padStart(6) + '            ' + String(r.dispHigh).padStart(6)
    + '     |    ' + String(r.plantGsp).padStart(6) + '      ' + String(r.plantFlagPct).padStart(5));
