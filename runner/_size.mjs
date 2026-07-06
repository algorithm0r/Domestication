// _size.mjs — READ ONLY. Estimate the storage footprint of the completed runs in Mongo:
// count docs, sample a few FULL docs to get mean serialized size, extrapolate.
import { connect, findAll, find } from './mongo.mjs';
const COLL = process.argv[2] || 'domestication-final-2026';
const socket = connect();
socket.on('connect_error', e => { console.log('connect_error:', e.message); process.exit(1); });
socket.on('connect', async () => {
  // count by setting to get total docs
  const meta = await findAll(socket, COLL, {}, { setting: 1 });
  const total = meta.length;
  // sample full docs (no projection) to size them
  const sample = await find(socket, COLL, {}, null, 25, 0);
  const sizes = sample.map(d => Buffer.byteLength(JSON.stringify(d)));
  const mean = sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1);
  const min = Math.min(...sizes), max = Math.max(...sizes);
  const estBytes = mean * total;
  const mb = n => (n / 1e6).toFixed(1) + ' MB', gb = n => (n / 1e9).toFixed(2) + ' GB';
  console.log(`collection: ${COLL}`);
  console.log(`total docs: ${total}`);
  console.log(`sampled ${sizes.length} full docs -> mean ${(mean/1024).toFixed(1)} KB/doc (min ${(min/1024).toFixed(1)}, max ${(max/1024).toFixed(1)} KB)`);
  console.log(`estimated total (JSON): ${estBytes > 1e9 ? gb(estBytes) : mb(estBytes)}  (~${Math.round(mean/1024)}KB × ${total})`);
  socket.close(); process.exit(0);
});
