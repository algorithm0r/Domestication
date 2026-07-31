// s4-anchor.mjs [collection] — convergence data for two contrasting conditions:
//   anchor = p20_plant_bottom (pop 80), which converges at the floor of 10, and
//   worst  = the condition with the most replicates in aggregate.json (the hardest bistable boundary case).
// Writes s4-anchor.json = { anchor:{single,domes,n,label}, worst:{single,domes,n,label} } where single is one
// run's 600x20 Abscission histogram and domes is the per-run non-shattering fraction in doc order. The pooled
// anchor histogram is csvs/disp20.csv; the pooled worst histogram is built here from the same pull.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { connect, find, findAll, settingKey } from './mongo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const OUT = path.join(HERE, '..', 'data', 'journal', 'regen2026');
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(HERE, 'data', COLL, 'aggregate.json'), 'utf8'));
const anchor = settings.find(s => s.id === 'p20_plant_bottom');
if (!anchor) { console.error('no p20_plant_bottom in settings.json'); process.exit(1); }
const worst = agg.slice().sort((a, b) => b.n - a.n)[0];   // most replicates = hardest to converge

const TICKS = 600, BUCKETS = 20;
function sumHist(docs, field) {   // pool a field's 600x20 histogram across replicate docs
  const h = Array.from({ length: TICKS }, () => new Array(BUCKETS).fill(0)); let any = false;
  for (const d of docs) { const g = d[field]; if (!g) continue; any = true;
    for (let t = 0; t < TICKS && t < g.length; t++) for (let b = 0; b < BUCKETS; b++) h[t][b] += (g[t]?.[b] || 0); }
  return any ? h : null;
}

const socket = connect();
socket.on('connect_error', e => { console.error('connect_error', e.message); process.exit(1); });
async function grab(key, poolSingle) {
  const domeDocs = await findAll(socket, COLL, { setting: key }, { dome: 1 });
  const domes = domeDocs.map(d => d.dome).filter(v => typeof v === 'number');
  const one = await find(socket, COLL, { setting: key }, { dispersalData: 1 }, 1, 0, 60000);
  const single = one && one.length ? one[0].dispersalData : null;
  let pooled = null;
  if (poolSingle) {                                    // worst case: pool here (no pre-made CSV like the anchor)
    const all = await findAll(socket, COLL, { setting: key }, { dispersalData: 1 });
    pooled = sumHist(all, 'dispersalData');
  }
  return { single, pooled, domes, n: domes.length };
}
socket.on('connect', async () => {
  const A = await grab(settingKey(anchor.config), false);
  const W = await grab(worst.setting, true);
  if (!A.single || !W.single) { console.error('missing single-run dispersalData'); process.exit(1); }
  const mean = d => (d.reduce((a, b) => a + b, 0) / d.length).toFixed(3);
  fs.writeFileSync(path.join(OUT, 's4-anchor.json'), JSON.stringify({
    anchor: { single: A.single, domes: A.domes, n: A.n, label: 'Anchor (plant first-harvested, pop 80)' },
    worst: { single: W.single, pooled: W.pooled, domes: W.domes, n: W.n, label: `Hardest boundary case (pop 140, 30% saved)` },
  }));
  console.log(`anchor n=${A.n} meanDome=${mean(A.domes)} | worst n=${W.n} meanDome=${mean(W.domes)} regime=${worst.regime}`);
  socket.close(); process.exit(0);
});
setTimeout(() => { console.error('watchdog timeout'); process.exit(1); }, 240000);
