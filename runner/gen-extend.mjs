// gen-extend.mjs — coverage-extension scout batch: push the sweep past the current grid edge
// to bracket the peak where it currently runs off-frame.
//   (a) population ceiling at moderate energy: pop150 × mt{20,25,30}
//   (b) low-pop energy tail: pop{50,60} × mt80
// Each cell gets BOTH the all-planting run (numPlanters=pop) and its wild-type control
// (numPlanters=0), n=10, so the corrected (planting-induced) value is available immediately.
// Anchor background otherwise. Idempotent: coordinator dedups by id.
const BASE = { epoch: 150000, humansAdded: 25000, plantingTime: 50000, predationChance: 0,
  harvestStrategy: 'random', plantStrategy: 'bottom',
  plantSelectionStrength: 0.2, plantSelectionChance: 1 };
const REPS = 10;
const p2 = v => String(v).padStart(2, '0');

// [pop, mt] cells to extend
const CELLS = [
  [150, 20], [150, 25], [150, 30],   // (a) population ceiling at moderate energy
  [160, 20], [160, 25], [160, 30],
  [170, 20], [170, 25], [170, 30],
  [180, 25], [190, 25], [200, 25],    // mt25 ceiling still open at pop170 (0.167) — push it

  [50, 80], [60, 80],                // (b) low-pop energy tail
  [50, 90], [60, 90],
  [50, 100],
  [50, 110],
];

const runs = [];
for (const [pop, mt] of CELLS) {
  for (const pl of [pop, 0]) {       // all-planting cell + its wild-type (numPlanters=0) control
    const config = { ...BASE, humanAddRate: pop, metabolicThreshold: mt, numPlanters: pl };
    for (let r = 1; r <= REPS; r++) runs.push({ id: `t2_pop${pop}_mt${p2(mt)}_pl${pl}_r${p2(r)}`, config });
  }
}

console.log(`built ${runs.length} extension runs: ${CELLS.length} cells × 2 (all-plant + wild) × ${REPS} reps`);
const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
