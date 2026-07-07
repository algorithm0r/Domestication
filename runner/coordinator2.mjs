// coordinator2.mjs <settings.json> [collection] — adaptive, settings-driven coordinator.
// Instead of a fixed FIFO run queue, it holds a LIST OF SETTINGS and dovetails over them: a
// round-robin pointer hands each worker the next rep of the next UNFINISHED setting, minting rep
// ids on demand. On /complete it appends that run's dome to the setting's bin and runs stats.mjs
// (evaluate); once a bin has >= MIN_N reps AND its CI meets target, the bin is FINISHED. The whole
// batch is done when every setting is finished. Bins are rebuilt from Mongo on startup, so it is
// fully resumable — an Indiana-Jones swap in for the old coordinator loses nothing (existing reps
// count toward the CIs). Same /claim,/complete,/error,/heartbeat,/status endpoints and same PORT as
// coordinator.mjs, so the running workers reconnect seamlessly with no worker change.
//
// Env: PORT (8088), MIN_N (3), MAX_N (none — CI-driven; set to cap a stalled bin). Mongo via mongo.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect as mongoConnect, insertRun, findAll, settingKey, domeOf } from './mongo.mjs';
import { evaluate } from './stats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = process.argv[2];
const COLL = process.argv[3] || 'domestication-final-2026';
const PORT = parseInt(process.env.PORT || '8088');
const MIN_N = parseInt(process.env.MIN_N || '3');
const MAX_N = process.env.MAX_N ? parseInt(process.env.MAX_N) : Infinity;
if (!SETTINGS_FILE) { console.error('usage: node coordinator2.mjs <settings.json> [collection]'); process.exit(1); }

const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
const bins = [];                                  // {id, config, key, domes[], dispatched, finished, ev}
const byKey = new Map(), byId = new Map();
for (const s of settings) {
  const key = settingKey(s.config);
  const bin = { id: s.id, config: s.config, key, domes: [], dispatched: 0, finished: false, ev: null };
  bins.push(bin); byKey.set(key, bin); byId.set(s.id, bin);
}

// --- Mongo store: reuse the ack/retry insert; dead-letter on failure so no run is ever lost ---
const DEADLETTER = path.join(HERE, 'deadletter');
const mongoSocket = mongoConnect();
async function storeToMongo(runId, data) {
  try { await insertRun(mongoSocket, COLL, data, { runId }); return true; }
  catch (e) {
    try { fs.mkdirSync(DEADLETTER, { recursive: true }); fs.writeFileSync(path.join(DEADLETTER, runId + '.json'), JSON.stringify(data)); } catch {}
    console.error(`mongo insert failed for ${runId} -> dead-lettered (${e.message})`);
    return false;
  }
}

const repId = (bin, n) => `${bin.id}_r${String(n).padStart(3, '0')}`;
const repNum = id => { const m = id.match(/_r0*(\d+)$/); return m ? parseInt(m[1]) : 0; };
function assess(bin) {
  bin.ev = evaluate(bin.domes);
  bin.finished = (bin.domes.length >= MIN_N && bin.ev.enough) || bin.domes.length >= MAX_N;
}

// --- resumable: rebuild every bin from the runs already in Mongo ---
async function rebuild() {
  const docs = await findAll(mongoSocket, COLL, {}, { dome: 1, setting: 1, runId: 1 });
  const maxRep = new Map();
  for (const d of docs) {
    if (d.setting == null || d.dome == null) continue;
    const bin = byKey.get(d.setting); if (!bin) continue;
    bin.domes.push(d.dome);
    if (d.runId) { const n = repNum(d.runId); if (n > (maxRep.get(bin) || 0)) maxRep.set(bin, n); }
  }
  for (const bin of bins) { bin.dispatched = Math.max(bin.domes.length, maxRep.get(bin) || 0); assess(bin); }
  const fin = bins.filter(b => b.finished).length;
  console.log(`coordinator2: ${bins.length} settings; rebuilt from ${docs.length} Mongo runs -> ${fin} finished, ${bins.length - fin} active (MIN_N=${MIN_N}, MAX_N=${MAX_N === Infinity ? 'none' : MAX_N})`);
}

// --- round-robin dispatch over unfinished bins (the dovetail is intrinsic) ---
let ptr = 0;
function nextBin() {
  for (let i = 0; i < bins.length; i++) { const b = bins[(ptr + i) % bins.length]; if (!b.finished) { ptr = (ptr + i + 1) % bins.length; return b; } }
  return null;                                    // all finished
}

const workers = new Map(); const recent = []; const startedAt = Date.now(); let completed = 0;
const counts = () => {
  const done = bins.filter(b => b.finished).length;
  const running = [...workers.values()].filter(w => w.runId && Date.now() - w.lastBeat < 60000).length;
  return { total: bins.length, done, pending: bins.length - done, running, error: 0, reps: bins.reduce((a, b) => a + b.domes.length, 0) };
};
function byType() {
  const t = {};
  for (const b of bins) { const ty = (b.id.match(/^[a-z]+/i) || [b.id])[0]; (t[ty] ||= { type: ty, done: 0, total: 0, running: 0, pending: 0, error: 0, reps: 0 }); t[ty].total++; if (b.finished) t[ty].done++; t[ty].reps += b.domes.length; }
  for (const v of Object.values(t)) v.pending = v.total - v.done;
  return Object.values(t);
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d ? JSON.parse(d) : {})); });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  if (req.method === 'GET' && p === '/claim') {
    const bin = nextBin();
    if (!bin) return json(res, 200, { done: true });
    bin.dispatched++;
    const id = repId(bin, bin.dispatched), w = u.searchParams.get('worker');
    if (w) { const prev = workers.get(w) || {}; workers.set(w, { ...prev, worker: w, host: u.searchParams.get('host'), runId: id, lastBeat: Date.now() }); }
    return json(res, 200, { id, config: bin.config });
  }
  if (req.method === 'POST' && p === '/complete') {
    const b = await readBody(req);
    const data = b.result && b.result.data;
    const bin = (data && data.setting && byKey.get(data.setting)) || byId.get(String(b.id).replace(/_r\d+$/, ''));
    if (data) await storeToMongo(b.id, data);
    let dome = null;
    if (data) { dome = data.dome != null ? data.dome : domeOf(data); if (bin && dome != null) { bin.domes.push(dome); assess(bin); } }
    completed++;
    recent.unshift({ id: b.id, host: b.host, dome, finished: bin ? bin.finished : false, n: bin ? bin.domes.length : null });
    recent.length = Math.min(recent.length, 20);
    return json(res, 200, { ok: true, cleanup: true });   // Mongo mode: worker can drop its local outfile
  }
  if (req.method === 'POST' && p === '/error') { return json(res, 200, { ok: true }); }   // failed rep: skip; bin stays active and gets another rep
  if (req.method === 'POST' && p === '/heartbeat') { const b = await readBody(req); workers.set(b.worker, { ...b, lastBeat: Date.now() }); return json(res, 200, { ok: true }); }
  if (req.method === 'GET' && p === '/status') {
    const c = counts();
    const ws = [...workers.values()].filter(w => Date.now() - w.lastBeat < 120000).map(w => ({ worker: w.worker, host: w.host || '', runId: w.runId, tick: w.tick || 0, totalTicks: w.totalTicks || 0, age: Math.round((Date.now() - w.lastBeat) / 1000), onRunSec: 0 }));
    return json(res, 200, {
      counts: c, byType: byType(), workers: ws, offlineWorkers: 0, etaSec: null,
      recent: recent.map(r => ({ id: r.id, host: r.host, dome: r.dome, finished: r.finished, n: r.n })),
      bins: bins.map(b => ({ id: b.id, n: b.domes.length, finished: b.finished, nNeeded: b.ev ? b.ev.nNeeded : null, ciHalf: b.ev ? b.ev.levelCIhalf : null, dome: b.ev ? +b.ev.conflatedMean.toFixed(3) : null })),
      done: c.done === c.total, startedAt, completed, adaptive: true
    });
  }
  json(res, 200, { ok: true });
});

mongoSocket.on('connect', async () => { await rebuild(); server.listen(PORT, '0.0.0.0', () => console.log(`coordinator2 on 0.0.0.0:${PORT}  (adaptive; ${bins.length} settings; collection ${COLL})`)); });
mongoSocket.on('connect_error', e => { console.error('mongo connect_error:', e.message); process.exit(1); });
