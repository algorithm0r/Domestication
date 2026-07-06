// coordinator.mjs — the shared work queue + log + live dashboard (option A).
// Owns the run queue; hands out runs atomically; records completions, stats,
// and worker heartbeats; serves a dashboard at http://<host>:PORT/.
//
// Usage: node coordinator.mjs [runlist.json] [state.json]   (PORT env, default 8088)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect as mongoConnect, insertRun, count as mongoCount } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '8088');
const QUEUE_FILE = process.argv[2] ?? path.join(HERE, 'runlist.json');
const STATE_FILE = process.argv[3] ?? path.join(HERE, 'queue-state.json');
const RESULTS_LOG = path.join(HERE, 'results.jsonl');
const RESULTS_DIR = path.join(HERE, 'results');           // centralized result payloads land here (file mode)

// --- Mongo mode: set MONGO_COLLECTION to insert runs into the DB instead of writing files ---
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || null;
const DEADLETTER = path.join(HERE, 'deadletter');         // failed inserts buffered here, never lost
let mongoSocket = null;
if (MONGO_COLLECTION) {
  mongoSocket = mongoConnect();
  mongoSocket.on('connect', () => console.log(`mongo connected -> ${MONGO_COLLECTION}`));
  mongoSocket.on('connect_error', e => console.error('mongo connect_error:', e.message));
  console.log(`MONGO MODE: runs insert into collection "${MONGO_COLLECTION}"`);
}

// store one run to Mongo with retry + timeout-verify; on total failure, dead-letter it (not lost)
async function storeToMongo(runId, data) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await insertRun(mongoSocket, MONGO_COLLECTION, data, { runId });
    if (res.ok) return true;
    if (res.reason === 'no-ack-timeout') {                // ambiguous — did it land? verify by runId
      const n = await mongoCount(mongoSocket, MONGO_COLLECTION, { runId }).catch(() => 0);
      if (n > 0) return true;
    }
  }
  try { fs.mkdirSync(DEADLETTER, { recursive: true });    // preserve so a failed insert never loses a run
    fs.writeFileSync(path.join(DEADLETTER, runId + '.json'), JSON.stringify({ collection: MONGO_COLLECTION, runId, data })); } catch {}
  console.error(`mongo insert failed for ${runId} -> dead-lettered`);
  return false;
}

// --- load or resume state (the shared log persists across restarts) ---
let runs;
if (fs.existsSync(STATE_FILE)) {
  runs = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  for (const r of runs) if (r.status === 'running') { r.status = 'pending'; r.claimedBy = null; } // requeue orphans
  console.log(`resumed ${runs.length} runs from ${path.basename(STATE_FILE)}`);
} else {
  const list = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  runs = list.map(r => ({ id: r.id, config: r.config, status: 'pending', claimedBy: null, host: null, startedAt: null, finishedAt: null, stats: null, error: null }));
  console.log(`loaded ${runs.length} runs from ${path.basename(QUEUE_FILE)}`);
}
const byId = new Map(runs.map(r => [r.id, r]));
const workers = new Map();          // workerId -> latest heartbeat
let startedAt = Date.now();
let lastSave = 0;
const LABELS = { 'DESKTOP-QQL4VJJ': 'algorithm0r-Main-2022' };   // friendly display names
const label = h => LABELS[h] || h;

const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(runs));
const maybeSave = () => { const n = Date.now(); if (n - lastSave > 3000) { saveState(); lastSave = n; } };
const counts = () => { const c = { pending: 0, running: 0, done: 0, error: 0, total: runs.length }; for (const r of runs) c[r.status] = (c[r.status] || 0) + 1; return c; };
const nextPending = () => runs.find(r => r.status === 'pending') || null;

function eta() {
  const done = runs.filter(r => r.status === 'done' && r.finishedAt);
  if (done.length < 2) return null;
  const first = Math.min(...done.map(r => r.finishedAt));
  const rate = done.length / ((Date.now() - first) / 1000);  // runs/sec
  const c = counts();
  return rate > 0 ? Math.round((c.pending + c.running) / rate) : null;
}
function throughputByHost() {
  const since = Date.now() - 10 * 60 * 1000, h = {};
  for (const r of runs) if (r.status === 'done' && r.finishedAt > since) h[label(r.host)] = (h[label(r.host)] || 0) + 1;
  return h; // completions in last 10 min, per host
}
function runType(id) {                                     // group runs by experiment family
  if (/^pp_|^e15_/.test(id)) return 'pop×planters';
  if (/^saved_/.test(id)) return 'saved%×pop';
  if (/^sel_/.test(id)) return 'selective%×pop';
  if (/^en_|^energy_|^erep_|^egrid_/.test(id)) return 'energy';   // egrid_ = energy×pop plot gap-fill
  if (/^p\d\d_|^lin_/.test(id)) return 'paper exp';     // lin_* lineage arms are paper experiments
  if (/^vol_/.test(id)) return 'volatility';
  if (/^base_|^enbase_/.test(id)) return 'baseline';    // enbase_* = per-(pop,energy) no-planting baselines
  return id.split('_')[0] || 'other';
}
function byType() {
  const t = {};
  for (const r of runs) { const ty = runType(r.id);
    (t[ty] ||= { type: ty, done: 0, running: 0, pending: 0, error: 0, total: 0 });
    t[ty][r.status] = (t[ty][r.status] || 0) + 1; t[ty].total++; }
  return Object.values(t).sort((a, b) => b.total - a.total);
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d ? JSON.parse(d) : {})); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'GET' && p === '/claim') {                 // atomic (Node single-threaded)
    const r = nextPending();
    if (!r) return json(res, 200, { done: true });
    const worker = url.searchParams.get('worker');
    // A worker runs one job at a time: any OTHER run still 'running' under this same worker id was
    // abandoned (interrupted without /complete or /error) — requeue it instead of leaking a zombie
    // claim. The reaper misses these because the worker id is alive (just on a newer run). (R: orphan leak)
    if (worker) for (const o of runs) if (o.status === 'running' && o.claimedBy === worker) { o.status = 'pending'; o.claimedBy = null; o.startedAt = null; }
    r.status = 'running'; r.claimedBy = worker; r.host = url.searchParams.get('host'); r.startedAt = Date.now();
    maybeSave();
    return json(res, 200, { id: r.id, config: r.config });
  }
  if (req.method === 'POST' && p === '/complete') {
    const b = await readBody(req); const r = byId.get(b.id);
    if (!r) return json(res, 200, { ok: true });
    if (MONGO_COLLECTION) {                                      // Mongo mode: insert run, no result file
      if (b.result) await storeToMongo(r.id, b.result.data);    // awaits ack/retry; dead-letters on failure
      r.status = 'done'; r.finishedAt = Date.now(); r.stats = b.stats; r.host = b.host || r.host;
      fs.appendFileSync(RESULTS_LOG, JSON.stringify({ id: r.id, host: r.host, stats: b.stats, mongo: true, t: Date.now() }) + '\n'); maybeSave();
      return json(res, 200, { ok: true, cleanup: true });       // tell worker its local outfile is disposable
    }
    r.status = 'done'; r.finishedAt = Date.now(); r.stats = b.stats; r.host = b.host || r.host;
    if (b.result) {                                             // file mode: write the data payload here
      try { fs.mkdirSync(RESULTS_DIR, { recursive: true }); fs.writeFileSync(path.join(RESULTS_DIR, r.id + '.json'), JSON.stringify(b.result)); }
      catch (e) { console.error('result write failed', r.id, e.message); }
    }
    fs.appendFileSync(RESULTS_LOG, JSON.stringify({ id: r.id, host: r.host, stats: b.stats, t: Date.now() }) + '\n'); maybeSave();
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && p === '/reset') {                // clear the queue tracker for a fresh batch
    runs.length = 0; byId.clear(); workers.clear(); startedAt = Date.now();   // results/*.json + results.jsonl are untouched
    saveState();
    return json(res, 200, { ok: true, total: 0 });
  }
  if (req.method === 'POST' && p === '/enqueue') {              // append runs to the live queue
    const b = await readBody(req); let added = 0, dup = 0;
    for (const r of (b.runs || [])) {
      if (byId.has(r.id)) { dup++; continue; }
      const run = { id: r.id, config: r.config, status: 'pending', claimedBy: null, host: null, startedAt: null, finishedAt: null, stats: null, error: null };
      runs.push(run); byId.set(run.id, run); added++;
    }
    saveState();
    return json(res, 200, { added, dup, total: runs.length });
  }
  if (req.method === 'POST' && p === '/error') {
    const b = await readBody(req); const r = byId.get(b.id);
    if (r) { r.status = 'error'; r.error = b.error; r.finishedAt = Date.now(); maybeSave(); }
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && p === '/heartbeat') {
    const b = await readBody(req); workers.set(b.worker, { ...b, lastBeat: Date.now() });
    return json(res, 200, { ok: true });
  }
  if (req.method === 'GET' && p === '/status') {
    const now = Date.now();
    const STALE = 45;                                          // s without a heartbeat -> treat as gone
    let ws = [...workers.values()].map(w => { const r = w.runId ? byId.get(w.runId) : null;
      const age = Math.round((now - w.lastBeat) / 1000);
      const switching = r ? r.status !== 'running' : !!w.runId; // its last run finished; between runs
      return { ...w, host: label(w.host), age, switching,
        onRunSec: (!switching && r && r.startedAt) ? Math.round((now - r.startedAt) / 1000) : null }; })
      .sort((a, b) => (a.host + a.worker).localeCompare(b.host + b.worker));
    const offlineWorkers = ws.filter(w => w.age > STALE).length;
    ws = ws.filter(w => w.age <= STALE);                       // hide gone workers from the live table
    const recent = runs.filter(r => r.status === 'done').sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 12)
      .map(r => ({ id: r.id, host: label(r.host), durationMs: r.stats?.durationMs, tps: r.stats?.ticksPerSec }));
    return json(res, 200, { counts: counts(), workers: ws, offlineWorkers, recent, etaSec: eta(), elapsedSec: Math.round((now - startedAt) / 1000), throughput: throughputByHost(), byType: byType() });
  }
  if (req.method === 'GET' && p === '/legacy') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(DASHBOARD); }
  if (req.method === 'GET' && p === '/') {                  // merged dashboard lives on the figserver (:8089); old one at /legacy
    const host = (req.headers.host || 'localhost:8088').replace(/:\d+$/, ':8089');
    res.writeHead(302, { Location: `http://${host}/` }); return res.end();
  }
  json(res, 404, { error: 'not found' });
});
server.listen(PORT, '0.0.0.0', () => console.log(`coordinator on 0.0.0.0:${PORT}  dashboard http://localhost:${PORT}/  (${counts().total} runs, ${counts().done} done)`));
process.on('SIGINT', () => { saveState(); console.log('\nstate saved.'); process.exit(0); });

// orphan reaper: requeue runs whose claiming worker went silent, and drop dead workers from the map
const REAP_MS = parseInt(process.env.REAP_MIN ?? '5') * 60 * 1000;
const MAX_RUN_MS = parseInt(process.env.MAX_RUN_MIN ?? '120') * 60 * 1000;   // hard cap: a real 150k run is <~55min, so >120min 'running' is orphaned regardless of worker liveness
setInterval(() => {
  const now = Date.now(); let reaped = 0;
  for (const r of runs) {
    if (r.status !== 'running') continue;
    const w = workers.get(r.claimedBy); const last = w ? w.lastBeat : (r.startedAt || 0);
    // requeue if the claiming worker went silent OR the run has been 'running' past the hard cap
    // (catches the reused-worker-id leak the silence check alone misses).
    if (now - last > REAP_MS || (r.startedAt && now - r.startedAt > MAX_RUN_MS)) { r.status = 'pending'; r.claimedBy = null; r.startedAt = null; reaped++; }
  }
  for (const [id, w] of workers) if (now - w.lastBeat > REAP_MS) workers.delete(id);   // dead workers leave the table
  if (reaped) { console.log(`reaper: requeued ${reaped} orphaned run(s)`); saveState(); }
}, parseInt(process.env.REAP_INTERVAL_MS ?? '60000'));

const DASHBOARD = `<!doctype html><html><head><meta charset=utf-8><title>run dashboard</title>
<style>
 body{font:13px system-ui,sans-serif;margin:16px;background:#111;color:#ddd}
 h1{font-size:16px;margin:0 0 8px} .muted{color:#888}
 .bar{height:18px;background:#222;border-radius:4px;overflow:hidden;margin:6px 0}
 .bar>div{height:100%;background:#3a7;transition:width .5s}
 table{border-collapse:collapse;width:100%;margin-top:10px} td,th{padding:4px 8px;text-align:left;border-bottom:1px solid #222}
 th{color:#999;font-weight:600} .pb{height:10px;background:#222;border-radius:3px;width:120px;display:inline-block;vertical-align:middle}
 .pb>div{height:100%;background:#48c;border-radius:3px} .pill{padding:1px 6px;border-radius:8px;font-size:11px}
 .g{background:#173}.y{background:#751}.r{background:#811} .k{display:inline-block;min-width:90px}
 .cols{display:flex;gap:22px;align-items:flex-start} .left{flex:1;min-width:0} .right{width:310px;flex-shrink:0}
 .tcard{margin-bottom:10px} .tcard .lbl{display:flex;justify-content:space-between;font-size:12px}
</style></head><body>
<h1>Domestication run cluster <span class=muted id=elapsed></span></h1>
<div id=summary></div><div class=bar><div id=prog style=width:0%></div></div>
<div id=eta class=muted></div>
<div class=cols>
 <div class=left>
  <h3>Workers <span class=muted id=wcount style=font-size:12px></span></h3><table id=wt><thead><tr><th>worker<th>host<th>run<th>progress<th>on&nbsp;run<th>pop<th>beat</tr></thead><tbody></tbody></table>
  <h3>Recent completions</h3><table id=rt><thead><tr><th>run<th>host<th>duration<th>ticks/s</tr></thead><tbody></tbody></table>
 </div>
 <div class=right>
  <h3>By run type</h3><div id=bytype class=muted>—</div>
 </div>
</div>
<script>
function fmt(s){if(s==null)return'-';var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+'h':'')+(m?m+'m':'')+x+'s'}
function beat(a){return a<30?'g':a<90?'y':'r'}
async function tick(){
 var s=await (await fetch('/status')).json(); var c=s.counts;
 document.getElementById('elapsed').textContent='elapsed '+fmt(s.elapsedSec);
 var pct=c.total?Math.round(100*c.done/c.total):0;
 document.getElementById('prog').style.width=pct+'%';
 var tp=Object.entries(s.throughput).map(function(e){return e[0]+': '+e[1]+'/10min'}).join('  |  ');
 document.getElementById('summary').innerHTML='<b>'+c.done+'</b>/'+c.total+' done ('+pct+'%) &nbsp; <span class=k>running '+c.running+'</span><span class=k>pending '+c.pending+'</span>'+(c.error?'<span class=k style=color:#e77>error '+c.error+'</span>':'')+'<br><span class=muted>'+tp+'</span>';
 document.getElementById('eta').textContent='ETA '+fmt(s.etaSec);
 var wb=s.workers.map(function(w){
   if(w.switching) return '<tr><td>'+w.worker+'<td>'+w.host+'<td colspan=4><span class=muted>switching…</span><td><span class="pill g">'+w.age+'s</span></tr>';
   var p=w.totalTicks?Math.round(100*w.tick/w.totalTicks):0;
   return '<tr><td>'+w.worker+'<td>'+w.host+'<td>'+(w.runId||'<span class=muted>idle</span>')+'<td><span class=pb><div style=width:'+p+'%></div></span> '+p+'%<td>'+fmt(w.onRunSec)+'<td>'+(w.pop||'-')+'<td><span class="pill '+beat(w.age)+'">'+w.age+'s</span></tr>'}).join('');
 document.querySelector('#wt tbody').innerHTML=wb||'<tr><td colspan=7 class=muted>no active workers</td></tr>';
 document.getElementById('wcount').textContent=s.workers.length+' active'+(s.offlineWorkers?', '+s.offlineWorkers+' finished':'');
 document.querySelector('#rt tbody').innerHTML=s.recent.map(function(r){return '<tr><td>'+r.id+'<td>'+r.host+'<td>'+fmt(r.durationMs?Math.round(r.durationMs/1000):null)+'<td>'+(r.tps||'-')+'</tr>'}).join('');
 document.getElementById('bytype').innerHTML=(s.byType||[]).map(function(t){var pct=t.total?Math.round(100*t.done/t.total):0;
   return '<div class=tcard><div class=lbl><b>'+t.type+'</b><span class=muted>'+t.done+'/'+t.total+' ('+pct+'%)</span></div>'+
     '<div class=bar style="height:10px;margin:3px 0"><div style=width:'+pct+'%></div></div>'+
     '<span class=muted style=font-size:11px>'+(t.running?'run '+t.running+' · ':'')+'pend '+t.pending+(t.error?' · <span style=color:#e77>err '+t.error+'</span>':'')+'</span></div>';
 }).join('')||'<span class=muted>no runs</span>';
}
tick();setInterval(tick,2000);
</script></body></html>`;
