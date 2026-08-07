// _orderprobe.mjs — does the per-tick update ORDER shift the domestication fraction?
// All variants run the domesticating bottom-planting anchor (pop80 / energy15).
//   real      : the actual Automata.prototype.update (control)
//   base      : reimplemented baseline (plants-first, humans reverse) -- must match `real`
//   humans1st : humans updated BEFORE plants (cross-population order swapped)
//   fwd       : plants-first, humans iterated FORWARD (vs the code's reverse)
//   shuf      : plants-first, humans iterated in a fresh random order each tick
// Prints tail-averaged domeFrac per variant across REPS; compares between-variant spread to within-variant noise.
// Usage: node _orderprobe.mjs [epoch=45000] [reps=4] [variants=real,base,humans1st,fwd,shuf]
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

const EPOCH = parseInt(process.argv[2] || '45000');  // NB production batch epoch is 100000
const REPS  = parseInt(process.argv[3] || '4');
const VARIANTS = (process.argv[4] || 'real,base,humans1st,fwd,shuf').split(',');
const timing = { epoch:EPOCH, humansAdded:Math.round(EPOCH/15), plantingTime:Math.round(EPOCH*8/45) };
const config = { humanAddRate:80, numPlanters:80, metabolicThreshold:15, plantSelectionStrength:0.2,
  harvestStrategy:'random', predationChance:0, plantStrategy:'bottom', plantSelectionChance:1, plantLineage:'off', ...timing };

const appendix = `
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {};

var origUpdate = Automata.prototype.update;

function seedsPass(board){ for (var i=board.seeds.length-1;i>=0;i--) board.seeds[i].update(); }
function humansPass(board, order){
  var idx=[], n=board.humans.length, i;
  if (order==='forward'){ for(i=0;i<n;i++) idx.push(i); }
  else if (order==='shuffle'){ for(i=0;i<n;i++) idx.push(i);
    for(i=n-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=idx[i]; idx[i]=idx[j]; idx[j]=t; } }
  else { for(i=n-1;i>=0;i--) idx.push(i); }           // reverse (the code's order)
  for(var k=0;k<idx.length;k++){ board.humans[idx[k]].update(); }  // humans never die in this model
}
function tailPass(board){                              // identical to the real update's tail
  for (var i=board.seeds.length-1;i>=0;i--){ if(board.seeds[i].dead){ board.seeds[i].cell.removeSeed(board.seeds[i]); board.seeds[i].spreadSeeds(); } }
  var w=0; for (var i=0;i<board.seeds.length;i++){ if(!board.seeds[i].dead) board.seeds[w++]=board.seeds[i]; } board.seeds.length=w;
  if (!params.individualSeedSeparation) board.partitionSeeds();
  if (board.shelter.seeds.length > params.granaryCap) board.shelter.seeds.splice(0, board.shelter.seeds.length-params.granaryCap);
  if (board.shelter.plantSeeds.length > params.granaryCap) board.shelter.plantSeeds.splice(0, board.shelter.plantSeeds.length-params.granaryCap);
  if (board.day % params.reportingPeriod === 0) board.dataMan.updateData();
}
function makeUpdate(plantsFirst, humanOrder){
  return function(){
    this.day++;
    if (this.day === params.humansAdded) this.addHumans(params.humanAddRate);
    if (this.day > params.epoch) { this.dataMan.logData(); this.reset(); }
    if (plantsFirst){ seedsPass(this); humansPass(this, humanOrder); }
    else { humansPass(this, humanOrder); seedsPass(this); }
    tailPass(this);
  };
}
var VARIMPL = {
  real:      origUpdate,
  base:      makeUpdate(true,  'reverse'),
  humans1st: makeUpdate(false, 'reverse'),
  fwd:       makeUpdate(true,  'forward'),
  shuf:      makeUpdate(true,  'shuffle'),
};

var results = {};
var TAIL = 0.8;                                        // average domeFrac over the last 20% of ticks
for (var v=0; v<__VARIANTS.length; v++){
  var name = __VARIANTS[v];
  Automata.prototype.update = VARIMPL[name];
  results[name] = [];
  for (var r=0; r<__REPS; r++){
    var board = new Automata();
    var epoch = params.epoch, tailStart = Math.floor(epoch*TAIL);
    var sum=0, cnt=0;
    for (var t=1; t<=epoch; t++){
      board.update();
      if (t>=tailStart && t % params.reportingPeriod === 0){
        var seeds = gameEngine.board.seeds, dome=0;
        for (var i=0;i<seeds.length;i++) if (seeds[i].dispersal.value < params.wildDomesticThreshold) dome++;
        sum += dome/Math.max(1,seeds.length); cnt++;
      }
    }
    results[name].push(+(sum/Math.max(1,cnt)).toFixed(4));
    console.error('DONE '+name+' rep'+(r+1)+'/'+__REPS+' dome='+results[name][r]+' pop='+gameEngine.board.seeds.length);
  }
}
__RESULT = results;
`;

const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = { console, document:{ getElementById:()=>fakeEl, createElement:()=>fakeEl }, window:{ setTimeout:()=>{} },
  navigator:{}, socket:null, Graph:class{constructor(){}draw(){}}, Histogram:class{constructor(){}draw(){}},
  __perf:performance, __CONFIG:config, __VARIANTS:VARIANTS, __REPS:REPS, __RESULT:null };
vm.createContext(sandbox);
const t0 = performance.now();
vm.runInContext(modelSrc + appendix, sandbox, { filename:'_orderprobe.js' });
const wall = ((performance.now()-t0)/1000).toFixed(0);

const R = sandbox.__RESULT;
const mean = a => a.reduce((p,c)=>p+c,0)/a.length;
const sd   = a => { const m=mean(a); return Math.sqrt(a.reduce((p,c)=>p+(c-m)*(c-m),0)/Math.max(1,a.length-1)); };
console.log('\\n=== update-order robustness  (anchor: bottom-plant, pop80/energy15; epoch='+EPOCH+', reps='+REPS+', '+wall+'s) ===');
console.log('variant      mean_dome    sd       reps');
const base = R.base ? mean(R.base) : (R.real ? mean(R.real) : null);
for (const name of VARIANTS){
  const a = R[name]; const m = mean(a);
  const delta = base!=null ? '   Δ_vs_base='+((m-base>=0?'+':'')+(m-base).toFixed(4)) : '';
  console.log(name.padEnd(11)+'  '+m.toFixed(4)+'     '+sd(a).toFixed(4)+'    ['+a.join(', ')+']'+delta);
}
