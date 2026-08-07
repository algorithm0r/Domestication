// _capprobe.mjs — how hard does the granaryCap bind, and on WHICH store?
// Runs the real update at the domesticating anchor (pop80 / energy15, bottom-plant) and
// records, every tick, the PRE-cap sizes of the two shared stores:
//   shelter.seeds       — the FOOD store (all harvest not set aside for planting)
//   shelter.plantSeeds  — the PLANTING store (~plantSelectionStrength of each returned basket)
// For the post-planting phase it reports, per store: % of ticks the cap binds, mean & max
// pre-cap size, and total seeds discarded by the cap. Answers "does it cap harvest more than planting?"
// Usage: node _capprobe.mjs [epoch=60000] [reps=2]
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

const EPOCH = parseInt(process.argv[2] || '60000');
const REPS  = parseInt(process.argv[3] || '2');
// production RATIOS: humans at 1/4 epoch, planting at 1/2 epoch (matches the 100k batch: 25000 / 50000)
const timing = { epoch:EPOCH, humansAdded:Math.round(EPOCH/4), plantingTime:Math.round(EPOCH/2) };
const config = { humanAddRate:80, numPlanters:80, metabolicThreshold:15, plantSelectionStrength:0.2,
  harvestStrategy:'random', predationChance:0, plantStrategy:'bottom', plantSelectionChance:1, plantLineage:'off', ...timing };

const appendix = `
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun = function () { this.run = 0; Object.assign(params, __CONFIG); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {};

// Recording update: byte-for-byte the real tail, but capture pre-cap sizes + overflow each tick.
Automata.prototype.update = function () {
    this.day++;
    if (this.day === params.humansAdded) this.addHumans(params.humanAddRate);
    if (this.day > params.epoch) { this.dataMan.logData(); this.reset(); }

    for (var i = this.seeds.length - 1; i >= 0; i--) this.seeds[i].update();
    for (var i = this.humans.length - 1; i >= 0; i--) {
        var human = this.humans[i]; human.update();
        if (human.dead) { this.humans.splice(i, 1); human.cell.removeHuman(human); }
    }
    for (var i = this.seeds.length - 1; i >= 0; i--) {
        var seed = this.seeds[i];
        if (seed.dead) { seed.cell.removeSeed(seed); seed.spreadSeeds(); }
    }
    var w = 0;
    for (var i = 0; i < this.seeds.length; i++) if (!this.seeds[i].dead) this.seeds[w++] = this.seeds[i];
    this.seeds.length = w;

    if (!params.individualSeedSeparation) this.partitionSeeds();

    // ---- instrument: read pre-cap sizes, then apply the real cap ----
    var foodPre = this.shelter.seeds.length, plantPre = this.shelter.plantSeeds.length;
    if (this.shelter.seeds.length > params.granaryCap)
        this.shelter.seeds.splice(0, this.shelter.seeds.length - params.granaryCap);
    if (this.shelter.plantSeeds.length > params.granaryCap)
        this.shelter.plantSeeds.splice(0, this.shelter.plantSeeds.length - params.granaryCap);
    __REC(this.day, foodPre, plantPre, this.seeds.length);

    if (this.day % params.reportingPeriod === 0) this.dataMan.updateData();
};

var CAP = params.granaryCap, PLANT_START = params.plantingTime;
var out = [];
for (var r=0; r<__REPS; r++){
    // accumulators over the post-planting phase
    var acc = { foodBind:0, plantBind:0, foodSum:0, plantSum:0, foodMax:0, plantMax:0,
                foodDisc:0, plantDisc:0, n:0, popSum:0 };
    globalThis.__REC = function(day, foodPre, plantPre, pop){
        if (day <= PLANT_START) return;                 // only steady-state, planting active
        acc.n++;
        acc.popSum += pop;
        acc.foodSum += foodPre;  acc.plantSum += plantPre;
        if (foodPre  > acc.foodMax)  acc.foodMax  = foodPre;
        if (plantPre > acc.plantMax) acc.plantMax = plantPre;
        if (foodPre  > CAP){ acc.foodBind++;  acc.foodDisc  += foodPre  - CAP; }
        if (plantPre > CAP){ acc.plantBind++; acc.plantDisc += plantPre - CAP; }
    };
    var board = new Automata();
    for (var t=1; t<=params.epoch; t++) board.update();
    out.push(acc);
    console.error('DONE rep'+(r+1)+'/'+__REPS+'  foodBind='+(100*acc.foodBind/acc.n).toFixed(0)+'%  plantBind='+(100*acc.plantBind/acc.n).toFixed(0)+'%');
}
__RESULT = { cap:CAP, epoch:params.epoch, plantStart:PLANT_START, reps:out };
`;

const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = { console, document:{ getElementById:()=>fakeEl, createElement:()=>fakeEl }, window:{ setTimeout:()=>{} },
  navigator:{}, socket:null, Graph:class{constructor(){}draw(){}}, Histogram:class{constructor(){}draw(){}},
  __perf:performance, __CONFIG:config, __REPS:REPS, __RESULT:null };
vm.createContext(sandbox);
const t0 = performance.now();
vm.runInContext(modelSrc + appendix, sandbox, { filename:'_capprobe.js' });
const wall = ((performance.now()-t0)/1000).toFixed(0);

const R = sandbox.__RESULT;
const agg = k => R.reps.reduce((p,c)=>p+c[k],0);
const N = agg('n');
const pct = x => (100*x/N).toFixed(1)+'%';
const per = x => (x/N).toFixed(1);
console.log('\n=== granaryCap binding  (anchor: bottom-plant pop80/energy15; epoch='+R.epoch+', planting from '+R.plantStart+', reps='+REPS+', '+wall+'s) ===');
console.log('cap = '+R.cap+' seeds per store; measured over '+N+' post-planting ticks\n');
console.log('store            binds%     mean_pre   max_pre   discarded/tick   total_discarded');
console.log('FOOD  (seeds)     '+pct(agg('foodBind')).padEnd(9)+'  '+per(agg('foodSum')).padEnd(9)+'  '+String(Math.max(...R.reps.map(c=>c.foodMax))).padEnd(7)+'   '+per(agg('foodDisc')).padEnd(14)+'   '+agg('foodDisc'));
console.log('PLANT (plantSeeds)'+pct(agg('plantBind')).padStart(9)+'  '+per(agg('plantSum')).padEnd(9)+'  '+String(Math.max(...R.reps.map(c=>c.plantMax))).padEnd(7)+'   '+per(agg('plantDisc')).padEnd(14)+'   '+agg('plantDisc'));
console.log('\nmean live seed pop (post-planting): '+per(agg('popSum')));
