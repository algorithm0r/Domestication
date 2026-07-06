// validate-mongo.mjs — prove the Mongo aggregation path with real data:
// insert two replicated settings into a throwaway collection, pull them back with a
// projection, group by setting, and check the pulled dome matches the file-based dome.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, insertRun, findAll, domeOf, settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = 'validate-' + process.pid;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// gather real replicate files for two settings
const pick = pre => fs.readdirSync(path.join(HERE, 'results')).filter(f => f.startsWith(pre) && /_r\d+\.json$/.test(f));
const files = [...pick('erep_pop80_mt15'), ...pick('vol_pop120_pl110')];
const local = files.map(f => { const o = JSON.parse(fs.readFileSync(path.join(HERE, 'results', f), 'utf8')); return { f, data: o.data, dome: domeOf(o.data) }; });
console.log(`loaded ${local.length} real replicate files (2 settings)`);

const socket = connect();
socket.on('connect', async () => {
  console.log('connected; inserting into throwaway collection', COLL);
  for (const r of local) insertRun(socket, COLL, r.data);
  await sleep(2500);                                            // let inserts land

  // pull back with projection — does the server honor it?
  const docs = await findAll(socket, COLL, {}, { dome: 1, setting: 1 });
  console.log(`pulled ${docs.length} docs back`);
  const keys = docs[0] ? Object.keys(docs[0]) : [];
  console.log('projection test — fields returned:', keys.join(', '), keys.includes('seedPop') ? '(projection NOT honored — heavy)' : '(projection honored — light ✓)');

  // group by setting, aggregate
  const bySetting = {};
  for (const d of docs) (bySetting[d.setting] ||= []).push(d.dome);
  console.log('\naggregated from Mongo:');
  for (const [k, vals] of Object.entries(bySetting)) {
    const n = vals.length, m = vals.reduce((s, x) => s + x, 0) / n;
    const ign = vals.filter(v => v > 0.1), p = ign.length / n;
    const lvl = ign.length ? ign.reduce((s, x) => s + x, 0) / ign.length : 0;
    console.log(`  ${k.slice(0, 60)}...  n=${n}  p_ignite=${p.toFixed(2)}  level=${lvl.toFixed(4)}  mean=${m.toFixed(4)}`);
  }

  // cross-check: Mongo dome vs file dome (match by exact value set)
  const fileDomes = local.map(r => r.dome).sort((a, b) => a - b);
  const mongoDomes = docs.map(d => d.dome).sort((a, b) => a - b);
  const match = fileDomes.length === mongoDomes.length && fileDomes.every((v, i) => Math.abs(v - mongoDomes[i]) < 1e-9);
  console.log(`\ncross-check file-dome vs mongo-dome: ${match ? 'IDENTICAL ✓' : 'MISMATCH ✗'} (${fileDomes.length} vs ${mongoDomes.length})`);
  socket.close();
  process.exit(match ? 0 : 1);
});
socket.on('connect_error', e => { console.log('connect_error:', e.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 30000);
