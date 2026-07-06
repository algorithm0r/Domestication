// pull.mjs [collection] — pull {dome,setting} from Mongo, aggregate per setting, and write
// the aggregate to data/<collection>/aggregate.json. Prints a sufficiency summary.
// This is the "files for aggregated data" half: Mongo holds raw runs; we derive aggregates here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, findAll } from './mongo.mjs';
import { evaluate } from './stats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLL = process.argv[2] || 'domestication-final-2026';
const OUTDIR = path.join(HERE, 'data', COLL);

const parseSetting = s => Object.fromEntries(s.split('|').map(kv => { const [k, v] = kv.split('='); return [k, isNaN(+v) ? v : +v]; }));

const socket = connect();
socket.on('connect', async () => {
  const docs = await findAll(socket, COLL, {}, { dome: 1, setting: 1 });
  const bySetting = {};
  for (const d of docs) if (d.setting != null && d.dome != null) (bySetting[d.setting] ||= []).push(d.dome);

  const settings = Object.entries(bySetting).map(([setting, domes]) => ({
    setting, params: parseSetting(setting), ...evaluate(domes),
  })).sort((a, b) => b.nNeeded - a.nNeeded);

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'aggregate.json'), JSON.stringify(settings, null, 1));

  const enough = settings.filter(s => s.enough).length;
  const needMore = settings.filter(s => !s.enough);
  console.log(`collection "${COLL}": ${docs.length} runs across ${settings.length} settings`);
  console.log(`  sufficient: ${enough}/${settings.length}    need more: ${needMore.length}`);
  const byReg = {}; settings.forEach(s => byReg[s.regime] = (byReg[s.regime] || 0) + 1);
  console.log(`  regimes: ${Object.entries(byReg).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  if (needMore.length) {
    console.log(`\n  top settings needing more replicates:`);
    for (const s of needMore.slice(0, 12))
      console.log(`    ${s.setting.slice(0, 52)}  n=${s.n} -> ${s.nNeeded}  (${s.regime}, p=${s.p.toFixed(2)}±${s.pCIhalf.toFixed(2)}, lvl=${s.level.toFixed(3)}±${s.levelCIhalf.toFixed(3)})`);
  }
  console.log(`\n  wrote ${path.relative(HERE, path.join(OUTDIR, 'aggregate.json'))}`);
  socket.close(); process.exit(0);
});
socket.on('connect_error', e => { console.log('connect_error:', e.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 60000);
