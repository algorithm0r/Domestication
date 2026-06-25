// coordinator.mjs — the shared work queue + log + live dashboard (option A).
// Owns the run queue; hands out runs atomically; records completions, stats,
// and worker heartbeats; serves a dashboard at http://<host>:PORT/.
//
// Usage: node coordinator.mjs [runlist.json] [state.json]   (PORT env, default 8088)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '8088');
const QUEUE_FILE = process.argv[2] ?? path.join(HERE, 'runlist.json');
const STATE_FILE = process.argv[3] ?? path.join(HERE, 'queue-state.json');
const RESULTS_LOG = path.join(HERE, 'results.jsonl');

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
const startedAt = Date.now();
let lastSave = 0;

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
  for (const r of runs) if (r.status === 'done' && r.finishedAt > since) h[r.host] = (h[r.host] || 0) + 1;
  return h; // completions in last 10 min, per host
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d ? JSON.parse(d) : {})); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'GET' && p === '/claim') {                 // atomic (Node single-threaded)
    const r = nextPending();
    if (!r) return json(res, 200, { done: true });
    r.status = 'running'; r.claimedBy = url.searchParams.get('worker'); r.host = url.searchParams.get('host'); r.startedAt = Date.now();
    maybeSave();
    return json(res, 200, { id: r.id, config: r.config });
  }
  if (req.method === 'POST' && p === '/complete') {
    const b = await readBody(req); const r = byId.get(b.id);
    if (r) { r.status = 'done'; r.finishedAt = Date.now(); r.stats = b.stats; r.host = b.host || r.host;
      fs.appendFileSync(RESULTS_LOG, JSON.stringify({ id: r.id, host: r.host, stats: b.stats, t: Date.now() }) + '\n'); maybeSave(); }
    return json(res, 200, { ok: true });
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
    const ws = [...workers.values()].map(w => ({ ...w, age: Math.round((now - w.lastBeat) / 1000) }))
      .sort((a, b) => (a.host + a.worker).localeCompare(b.host + b.worker));
    const recent = runs.filter(r => r.status === 'done').sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 12)
      .map(r => ({ id: r.id, host: r.host, durationMs: r.stats?.durationMs, tps: r.stats?.ticksPerSec }));
    return json(res, 200, { counts: counts(), workers: ws, recent, etaSec: eta(), elapsedSec: Math.round((now - startedAt) / 1000), throughput: throughputByHost() });
  }
  if (req.method === 'GET' && p === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(DASHBOARD); }
  json(res, 404, { error: 'not found' });
});
server.listen(PORT, '0.0.0.0', () => console.log(`coordinator on 0.0.0.0:${PORT}  dashboard http://localhost:${PORT}/  (${counts().total} runs, ${counts().done} done)`));
process.on('SIGINT', () => { saveState(); console.log('\nstate saved.'); process.exit(0); });

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
</style></head><body>
<h1>Domestication run cluster <span class=muted id=elapsed></span></h1>
<div id=summary></div><div class=bar><div id=prog style=width:0%></div></div>
<div id=eta class=muted></div>
<h3>Workers</h3><table id=wt><thead><tr><th>worker<th>host<th>run<th>progress<th>pop<th>beat</tr></thead><tbody></tbody></table>
<h3>Recent completions</h3><table id=rt><thead><tr><th>run<th>host<th>duration<th>ticks/s</tr></thead><tbody></tbody></table>
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
 var wb=s.workers.map(function(w){var p=w.totalTicks?Math.round(100*w.tick/w.totalTicks):0;
   return '<tr><td>'+w.worker+'<td>'+w.host+'<td>'+(w.runId||'<span class=muted>idle</span>')+'<td><span class=pb><div style=width:'+p+'%></div></span> '+p+'%<td>'+(w.pop||'-')+'<td><span class="pill '+beat(w.age)+'">'+w.age+'s</span></tr>'}).join('');
 document.querySelector('#wt tbody').innerHTML=wb||'<tr><td colspan=6 class=muted>no workers yet</td></tr>';
 document.querySelector('#rt tbody').innerHTML=s.recent.map(function(r){return '<tr><td>'+r.id+'<td>'+r.host+'<td>'+(r.durationMs?Math.round(r.durationMs/1000)+'s':'-')+'<td>'+(r.tps||'-')+'</tr>'}).join('');
}
tick();setInterval(tick,2000);
</script></body></html>`;
