// _holdwindow.mjs — how many ticks does a plant hold its seeds (maturity -> drop)?
// Reads the real formula and step-measures it (seedDeathChance forced to 0 to isolate the drop mechanism).
// window = dropThreshold - threshold = (100*(1-abscission))/growthUnit + 1 ; growthUnit = (1-root)*(water+11) + root*8
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

const appendix = `
params.seedDeathChance = 0; params.predationChance = 0;   // isolate the deterministic drop
var CASES = [
  {name:'shallow / wettest (water=4)', root:0, water:4},
  {name:'shallow / mid     (water=0)', root:0, water:0},
  {name:'deep    / any     (water=*)', root:1, water:0},
  {name:'shallow / dry     (water=-7)',root:0, water:-7},
  {name:'shallow / v.dry   (water=-10)',root:0, water:-10},
];
var ABSC = [0.0, 0.3, 0.6, 0.9];   // abscission gene: 0 = fully non-shattering ... 0.9 = shattering
function build(root, water, absc){
  var cell = { x:0, y:0, water:water, shelter:false };
  var s = new Seed({ cell: cell });
  s.weight.value=0.5; s.deepRoots.value=root; s.fecundity.value=0.5; s.dispersal.value=absc;  // dispersal gene = paper Abscission
  s.penalty = s.weight.value+s.deepRoots.value+s.fecundity.value+s.dispersal.value;
  s.growthUnit = (1-s.deepRoots.value)*(cell.water-params.dry) + s.deepRoots.value*params.range/2;
  s.threshold = Math.ceil((params.germThreshold + s.penalty*params.growthPenalty)/s.growthUnit);
  s.dropThreshold = s.threshold + ((params.fullGrown*(1-s.dispersal.value))/s.growthUnit) + 1;
  s.growth=0; s.dead=false; s.seeds=0;
  return s;
}
function stepHold(s){                     // step update() from birth; count ticks from maturity to drop
  var mature=null, drop=null;
  for (var t=1; t<=200000; t++){ s.update(); if (s.growth===s.threshold && mature===null) mature=t; if (s.dead){ drop=t; break; } }
  return (mature!=null && drop!=null) ? (drop-mature) : null;
}
var out = [];
for (var c=0;c<CASES.length;c++){ var C=CASES[c];
  var gu = (1-C.root)*(C.water-params.dry) + C.root*params.range/2;
  var row = { name:C.name, gu:+gu.toFixed(2), cells:[] };
  for (var a=0;a<ABSC.length;a++){
    var s = build(C.root, C.water, ABSC[a]);
    var formula = gu>0 ? +((params.fullGrown*(1-ABSC[a]))/gu + 1).toFixed(1) : Infinity;
    var emp = gu>0 ? stepHold(build(C.root,C.water,ABSC[a])) : null;
    row.cells.push({ absc:ABSC[a], thr:s.threshold, drop:+s.dropThreshold.toFixed(1), formula:formula, hold:emp });
  }
  out.push(row);
}
__RESULT = out;
`;
const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = { console, document:{ getElementById:()=>fakeEl, createElement:()=>fakeEl }, window:{ setTimeout:()=>{} },
  navigator:{}, socket:null, Graph:class{constructor(){}draw(){}}, Histogram:class{constructor(){}draw(){}}, __RESULT:null };
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename:'_holdwindow.js' });

console.log('Holding window = ticks a mature plant retains its seeds before dropping (seedDeathChance=0).');
console.log('abscission: 0.0=fully non-shattering (domesticated) ... 0.9=shattering (wild). Non-shattering = abscission < 0.6.\n');
for (const r of sandbox.__RESULT){
  console.log(r.name + '   growthUnit=' + r.gu);
  console.log('   absc   threshold  dropThr   hold(ticks)');
  for (const c of r.cells)
    console.log('   ' + c.absc.toFixed(1) + '      ' + String(c.thr).padStart(5) + '     ' + String(c.drop).padStart(6) + '     ' + String(c.hold).padStart(4) + '  (formula ' + c.formula + ')');
  console.log('');
}
