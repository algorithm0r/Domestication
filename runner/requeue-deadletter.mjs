// requeue-deadletter.mjs — re-insert runs that dead-lettered during a DB outage back into Mongo.
// The coordinator writes {collection, runId, data} to deadletter/ when storeToMongo fails; once the
// DB is healthy these can be replayed. Idempotent by runId. Deletes each file on successful insert.
import fs from 'node:fs';
import path from 'node:path';
import { connect, insertRun } from './mongo.mjs';

import { fileURLToPath } from 'node:url';
const DL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'deadletter');
const files = fs.existsSync(DL) ? fs.readdirSync(DL).filter(f => f.endsWith('.json')) : [];
console.log(`replaying ${files.length} dead-lettered runs`);

const sock = connect();
sock.on('connect_error', e => { console.log('connect_error', e.message); process.exit(1); });
sock.on('connect', async () => {
  let ok = 0, fail = 0;
  for (const f of files) {
    let rec; try { rec = JSON.parse(fs.readFileSync(path.join(DL, f), 'utf8')); } catch { fail++; continue; }
    if (!rec.data || !rec.collection) { fail++; continue; }
    const res = await insertRun(sock, rec.collection, rec.data, { runId: rec.runId });
    if (res && res.ok) { ok++; fs.unlinkSync(path.join(DL, f)); }
    else { fail++; console.log('  FAIL', f, JSON.stringify(res).slice(0, 80)); }
    if ((ok + fail) % 10 === 0) console.log(`  ${ok + fail}/${files.length}`);
  }
  console.log(`\nreinserted ${ok}, failed ${fail} (kept failed files for retry)`);
  sock.close(); process.exit(0);
});
