// mongo.mjs — thin client for the socket.io DB backend (research.climbinggiants.com:8888).
// The server stores the emitted `data` object AS the document, and answers find/count/distinct
// by emitting the result back. We add two derived top-level fields to every stored doc:
//   dome    — the scalar domestication metric (so aggregation needn't pull the big arrays)
//   setting — a key shared by all replicates of one configuration (for grouping)
import { io } from 'socket.io-client';

export const MONGO_URL = process.env.MONGO_URL || 'https://research.climbinggiants.com:8888';
export const MONGO_DB  = process.env.MONGO_DB  || 'domesticationDB';

export function connect() {
  return io(MONGO_URL, { reconnection: true, transports: ['websocket', 'polling'] });
}

// the dome metric, computed from a stored data object (params/seedPop/domeSeedPop/...)
export function domeOf(data) {
  const n = data.seedPop.length, st = Math.floor(n * 0.67);
  let dm = 0, c = 0;
  for (let i = st; i < n; i++) if (data.seedPop[i] > 0) { dm += data.domeSeedPop[i] / data.seedPop[i]; c++; }
  return c ? dm / c : null;
}

// a config -> setting key (replicates of the same setting share it)
const SETTING_FIELDS = ['humanAddRate','numPlanters','metabolicThreshold','plantSelectionStrength',
  'plantSelectionChance','harvestStrategy','plantStrategy','predationChance','epoch','humansAdded','plantingTime'];
export function settingKey(params) {
  let k = SETTING_FIELDS.map(f => `${f}=${params[f]}`).join('|');
  // lineage experiment adds an optional segment; omitted when "off"/absent so every
  // pre-existing run keeps its exact key (no regrouping of the in-flight batch).
  if (params.plantLineage && params.plantLineage !== 'off') k += `|plantLineage=${params.plantLineage}`;
  return k;
}

// interpret the server's ack: ackOk(ack,{inserted}) on success, ackErr(ack,msg) on failure.
function ackResult(ack, expected) {
  if (!ack) return { ok: false, reason: 'no-ack-timeout' };
  if (ack.error || ack.ok === false || ack.status === 'error') return { ok: false, reason: ack.error || 'ackErr', ack };
  const inserted = typeof ack.inserted === 'number' ? ack.inserted : (ack.ok === true || ack.status === 'ok' ? expected : 0);
  return { ok: inserted >= expected, inserted, ack };           // confirm the count landed
}
const emitAck = (socket, msg, timeoutMs, expected) => new Promise(resolve => {
  let settled = false;
  const t = setTimeout(() => { if (!settled) { settled = true; resolve({ ok: false, reason: 'no-ack-timeout' }); } }, timeoutMs);
  socket.emit('insert', msg, ack => { if (!settled) { settled = true; clearTimeout(t); resolve(ackResult(ack, expected)); } });
});

// insert ONE run (data + derived dome/setting + optional runId for idempotency/verification).
export function insertRun(socket, collection, data, { runId = null, timeoutMs = 15000 } = {}) {
  const doc = { ...data, dome: domeOf(data), setting: settingKey(data.params), ...(runId ? { runId } : {}) };
  return emitAck(socket, { db: MONGO_DB, collection, data: doc }, timeoutMs, 1);
}

// insert MANY runs at once (server insertMany, chunked). datas: array of data objects.
export function insertMany(socket, collection, datas, { timeoutMs = 60000 } = {}) {
  const docs = datas.map(d => ({ ...d, dome: domeOf(d), setting: settingKey(d.params) }));
  return emitAck(socket, { db: MONGO_DB, collection, data: docs }, timeoutMs, docs.length);
}

// promisified find with a one-shot listener (use sequentially, not concurrently).
// NB: the server reads the projection under the key `projection` (NOT `filter`, which
// graphs.js sends but the server ignores) — verified empirically.
// NB: both carry a timeout — without it, a hung DB (server up, MongoDB wedged) makes these
// never resolve, which cascades into storeToMongo's verify step hanging /complete forever and
// freezing the whole batch. On timeout we resolve a benign empty/null so callers fall through
// (find -> [], count -> null) rather than wedge. (Hardened after the 2026-06-30 mongod outage.)
export function find(socket, collection, query = {}, projection = null, limit = 1000, page = 0, timeoutMs = 30000) {
  return new Promise(resolve => {
    let settled = false;
    const onFind = arr => { if (settled) return; settled = true; clearTimeout(t); resolve(Array.isArray(arr) ? arr : []); };
    const t = setTimeout(() => { if (settled) return; settled = true; socket.off('find', onFind); resolve([]); }, timeoutMs);
    socket.once('find', onFind);
    socket.emit('find', { db: MONGO_DB, collection, query, projection, limit, page });
  });
}
export function count(socket, collection, query = {}, timeoutMs = 30000) {
  return new Promise(resolve => {
    let settled = false;
    const onCount = n => { if (settled) return; settled = true; clearTimeout(t); resolve(n); };
    const t = setTimeout(() => { if (settled) return; settled = true; socket.off('count', onCount); resolve(null); }, timeoutMs);
    socket.once('count', onCount);
    socket.emit('count', { db: MONGO_DB, collection, query });
  });
}

// pull ALL docs matching a query, paginated, with an optional projection
export async function findAll(socket, collection, query = {}, projection = null, pageSize = 500) {
  const out = []; let page = 0;
  while (true) {
    const batch = await find(socket, collection, query, projection, pageSize, page);
    out.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }
  return out;
}
