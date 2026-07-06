// test-mongo.mjs — verify we can drive the socket.io DB backend from Node:
// connect (self-signed TLS) -> insert a throwaway doc -> count -> find it back.
import { io } from 'socket.io-client';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';            // server uses a self-signed cert

const URL = process.argv[2] || 'https://research.climbinggiants.com';
const DB = 'domesticationDB', COLL = 'test-roundtrip-' + process.pid;
const socket = io(URL, { rejectUnauthorized: false, reconnection: false, timeout: 8000, transports: ['websocket', 'polling'] });

const done = (ok, msg) => { console.log(ok ? 'PASS: ' + msg : 'FAIL: ' + msg); socket.close(); process.exit(ok ? 0 : 1); };

socket.on('connect', () => {
  console.log('connected, id =', socket.id);
  socket.emit('insert', { db: DB, collection: COLL, data: { params: { runName: 'rt', humanAddRate: 99, numPlanters: 7 }, seedPop: [10, 20], domeSeedPop: [1, 5] } });
  console.log('insert emitted; counting in 1.5s...');
  setTimeout(() => socket.emit('count', { db: DB, collection: COLL, query: { 'params.runName': 'rt' } }), 1500);
});
socket.on('count', (len) => {
  console.log('count(rt) =', len);
  if (!len) return done(false, 'insert did not land (count=0)');
  socket.emit('find', { db: DB, collection: COLL, query: { 'params.runName': 'rt' }, limit: 1 });
});
socket.on('find', (arr) => {
  const n = Array.isArray(arr) ? arr.length : 0;
  console.log('find returned', n, 'doc(s)');
  if (n) console.log('  sample:', JSON.stringify(arr[0]).slice(0, 200));
  done(n > 0, n > 0 ? 'round-trip works (insert+count+find)' : 'find returned nothing');
});
socket.on('connect_error', e => done(false, 'connect_error: ' + e.message));
socket.on('error', e => console.log('socket error:', e));
setTimeout(() => done(false, 'timeout — no response in 15s'), 15000);
