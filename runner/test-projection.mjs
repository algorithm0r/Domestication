// test-projection.mjs — does the server honor the `filter` projection on find?
import { connect, MONGO_DB } from './mongo.mjs';
const COLL = 'projtest-' + process.pid;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const socket = connect();

function find(query, filter) {
  return new Promise(res => { socket.once('find', a => res(Array.isArray(a) ? a : [])); socket.emit('find', { db: MONGO_DB, collection: COLL, query, filter, limit: 5, page: 0 }); });
}

socket.on('connect', async () => {
  console.log('connected');
  socket.emit('insert', { db: MONGO_DB, collection: COLL, data: { params: { runName: 'p', humanAddRate: 80 }, seedPop: [1, 2, 3], domeSeedPop: [0, 1, 2], dome: 0.42, setting: 'h80' } });
  await sleep(2000);

  const full = await find({ 'params.runName': 'p' }, null);
  console.log('\nfind with filter=null  -> fields:', full[0] ? Object.keys(full[0]).join(', ') : '(none)');

  const proj = await find({ 'params.runName': 'p' }, { dome: 1, setting: 1 });
  console.log("find with filter={dome:1,setting:1} -> fields:", proj[0] ? Object.keys(proj[0]).join(', ') : '(none)');
  const ok = proj[0] && !('seedPop' in proj[0]) && ('dome' in proj[0]);
  console.log('\nPROJECTION', ok ? 'HONORED ✓ (light pulls possible)' : 'NOT honored ✗ (still returns full docs)');
  if (proj[0]) console.log('  projected doc:', JSON.stringify(proj[0]));
  socket.close(); process.exit(0);
});
socket.on('connect_error', e => { console.log('connect_error', e.message); process.exit(1); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 20000);
