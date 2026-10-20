// _fig1-env.mjs — dump one board snapshot for the paper's environment figure (Figure 1).
// Loads the real model exactly as headless.mjs does, runs the baseline condition (experiment 21:
// population 80, all planting the first-harvested seeds) to a tick after planting has begun, and
// writes every cell's water level and shelter flag, every plant's root-depth gene and slot index,
// and every human's position. A separate renderer (paper/tools/fig1_env.py) draws it as a vector
// PDF using the same colors as cell.js, seed.js and human.js.
//
// Usage: node _fig1-env.mjs <tick> <out.json>
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MODEL = ['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js'];
const tick = +(process.argv[2] ?? 60000);
const outFile = process.argv[3] ?? 'fig1-board.json';
const config = { humanAddRate: 80, numPlanters: 80, metabolicThreshold: 20, plantSelectionStrength: 0.2,
                 plantSelectionChance: 1, harvestStrategy: 'random', plantStrategy: 'bottom', predationChance: 0,
                 epoch: 100000, humansAdded: 25000, plantingTime: 50000 };

const modelSrc = MODEL.map(f => `\n//==== ${f} ====\n` + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');
const appendix = `
var gameEngine = new GameEngine();
loadParameters = function () {};
Automata.prototype.nextRun     = function () { this.run = 0; Object.assign(params, __CONFIG); };
Automata.prototype.applyPreset = function () { this.run = 0; Object.assign(params, __CONFIG); this.buildAutomata(); };
DataManager.prototype.draw = function () {};
DataManager.prototype.logData = function () {};
var board = new Automata();
for (var __k in __CONFIG) if (params[__k] !== __CONFIG[__k]) throw new Error('config key not applied: ' + __k);
for (var t = 1; t <= __TICK; t++) board.update();
var B = gameEngine.board, cells = [], plants = [], humans = [];
for (var i = 0; i < params.dimension; i++) for (var j = 0; j < params.dimension; j++) {
  var c = B.board[i][j];
  cells.push({ x: c.x, y: c.y, water: c.water, shelter: !!c.shelter });
  for (var k = 0; k < c.seeds.length; k++) plants.push({ x: c.x, y: c.y, slot: k, root: c.seeds[k].deepRoots.value });
  for (var h = 0; h < c.humans.length; h++) humans.push({ x: c.humans[h].x, y: c.humans[h].y, color: c.humans[h].color });
}
__RESULT = { tick: __TICK, day: B.day, size: params.size, dimension: params.dimension, config: __CONFIG, cells: cells, plants: plants, humans: humans };
`;
const fakeEl = { value:'', checked:false, innerHTML:'', classList:{add(){},remove(){}}, setAttribute(){}, click(){}, getContext:()=>({}) };
const sandbox = {
  console, document: { getElementById:()=>fakeEl, createElement:()=>fakeEl }, window: { setTimeout:()=>{} },
  navigator: {}, socket: null, Graph: class { draw(){} }, Histogram: class { draw(){} },
  __perf: performance, __CONFIG: config, __TICK: tick, __RESULT: null,
};
vm.createContext(sandbox);
vm.runInContext(modelSrc + appendix, sandbox, { filename: 'fig1-env.js' });
fs.writeFileSync(outFile, JSON.stringify(sandbox.__RESULT));
const r = sandbox.__RESULT;
console.log(`tick ${r.tick}: ${r.cells.length} cells, ${r.plants.length} plants, ${r.humans.length} humans -> ${outFile}`);
