// figserver.mjs — dashboard: live run progress (active batch) + a BATCH VIEWER that lists every
// DB collection and renders the figures for whichever one you pick. Port 8089.
// Usage: node figserver.mjs   (PORT default 8089; COORD default :8088; COLL = active/live batch)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { settingKey } from './mongo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '8089');
const COORD = process.env.COORD ?? 'http://localhost:8088';
const ACTIVE_COLL = process.env.COLL || 'domestication-final-2026';   // the live batch (progress view)
const MONGO_DB = process.env.MONGO_DB || 'domesticationDB';

const FIGS = [
  { svg: 'fig_pp.svg',        div: 'fig_pp_div.svg',        cap: 'Planting effort × population' },
  { svg: 'fig_saved.svg',     div: 'fig_saved_div.svg',     cap: 'saved% × population' },
  { svg: 'fig_selective.svg', div: 'fig_selective_div.svg', cap: 'selective% × population' },
  { svg: 'fig_energy.svg',    div: 'fig_energy_div.svg',    cap: 'energy × population' },
];

// ---- render a collection's figures (pull -> mongo-figs -> paper-figs), cached per collection ----
function run(args) {
  return new Promise(res => { const ch = spawn('node', [path.join(HERE, args[0]), ...args.slice(1)], { cwd: HERE });
    ch.on('close', () => res()); ch.on('error', () => res()); });
}
const figCache = {};                                    // coll -> { ts, version, regenerating }
async function regen(coll) {
  const c = figCache[coll] || (figCache[coll] = { ts: 0, version: 0, regenerating: false });
  if (c.regenerating) return; c.regenerating = true;
  try {
    // cheap + live: dome heatmaps read aggregate.json (pull uses a {dome,setting} projection — no big arrays).
    await run(['pull.mjs', coll]); await run(['mongo-figs.mjs', coll]);
    // heavy + slow-changing: div/collapse do ~O(cells) SERIAL Mongo gsp-array pulls (minutes on a large grid);
    // paper-figs spawns a python render burst. These barely move mid-run, so throttle HARD (15 min) — at the old
    // 3-min-in-a-30s-loop cadence the server ran them essentially back-to-back and thrashed CPU/Mongo, which is
    // brutal while a compute batch shares the box. Dome still refreshes every cycle; divergence lags 15 min.
    if (Date.now() - (c.divTs || 0) > 300000) {   // 5 min — div-figs/collapse now use a rep-count cache: cheap unless cells actually changed
      await run(['paper-figs.mjs', coll]); await run(['div-figs.mjs', coll]); await run(['collapse-fig.mjs', coll]); await run(['compose-figs.mjs', coll]); c.divTs = Date.now(); }
    c.ts = Date.now(); c.version = Math.round(c.ts / 1000); }
  finally { c.regenerating = false; }
}
function readFigs(coll) {
  const dir = path.join(HERE, 'data', coll);
  const sweeps = FIGS.map(f => { const p = path.join(dir, f.svg), dp = path.join(dir, f.div);
    return { cap: f.cap, svg: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '<div class=missing>pending…</div>',
      div: fs.existsSync(dp) ? fs.readFileSync(dp, 'utf8') : '<div class=missing>divergence pending…</div>' }; });
  let paper = [];
  const mp = path.join(dir, 'paper-manifest.json');
  if (fs.existsSync(mp)) paper = JSON.parse(fs.readFileSync(mp, 'utf8')).map(e => { const p = path.join(dir, e.svg); return { id: e.id, svg: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '' }; });
  const cp = path.join(dir, 'fig_collapse.svg');
  const collapse = fs.existsSync(cp) ? fs.readFileSync(cp, 'utf8') : '';
  return { coll, version: (figCache[coll] && figCache[coll].version) || 0, sweeps, paper, collapse };
}

// ---- the PAPER FIGURES view: the FINAL regenerated figures (real matplotlib PDFs -> PNG + the sweep/
//      collapse PNGs) produced by regen-paper.mjs into data/<coll>/final/. This is the manuscript review
//      surface — what actually drops into the .tex. ----
function readFinal(coll) {
  const mp = path.join(HERE, 'data', coll, 'final', 'manifest.json');
  if (!fs.existsSync(mp)) return { coll, figs: [], mtime: 0 };
  try { const m = JSON.parse(fs.readFileSync(mp, 'utf8')); return { coll, figs: m.figs || [], mtime: Math.round(fs.statSync(mp).mtimeMs / 1000) }; }
  catch { return { coll, figs: [], mtime: 0 }; }
}

// ---- run/setting detail: list settings that have data, and render one setting's distributions ----
let idMap = null;
function buildIdMap() {   // merge the live batch AND any side-experiment settings files, so their ids label the runs
  idMap = {};
  for (const f of ['settings.json', 'artificial-settings.json']) {
    try { const s = JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8')); for (const x of s) idMap[settingKey(x.config)] = x.id; } catch {}
  }
}
function settingsFor(coll) {
  const p = path.join(HERE, 'data', coll, 'aggregate.json');
  if (!fs.existsSync(p)) return [];
  let agg; try { agg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
  if (!idMap) buildIdMap();
  return agg.map(e => { const pr = e.params || {}; const key = e.setting || settingKey(pr);
    // artificial side experiment: self-describing label so the 3 regimes aren't all "pop0 … none/none".
    const artLabel = pr.artificial ? `ARTIFICIAL · ${pr.artificial}` + (pr.burnin ? ` · burn-in ${pr.burnin}` : '') + (pr.burnPredation ? ` · predation ${pr.burnPredation}` : '') : null;
    const label = idMap[key] || artLabel || `pop${pr.humanAddRate} mt${pr.metabolicThreshold} pl${pr.numPlanters} sv${pr.plantSelectionStrength} sc${pr.plantSelectionChance} ${pr.plantStrategy}/${pr.harvestStrategy}`;
    return { key, label, n: e.n || 0, dome: e.conflatedMean != null ? +e.conflatedMean.toFixed(3) : null }; })
    .sort((a, b) => a.label.localeCompare(b.label));
}
const settingCache = {};                                // coll|key -> { ts, svg }
async function renderSetting(coll, key) {
  const ck = coll + '|' + key, cached = settingCache[ck];
  if (cached && Date.now() - cached.ts < 20000) return cached.svg;
  const id = Buffer.from(ck).toString('base64url').slice(0, 44);
  const file = path.join(HERE, 'data', coll, 'setting_' + id + '.svg');
  await run(['setting-fig.mjs', coll, key, file]);
  const svg = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '<div class=missing>render failed</div>';
  settingCache[ck] = { ts: Date.now(), svg };
  return svg;
}

// ---- list DB collections (batch names) + doc counts, cached (via mongosh on the Mongo box) ----
let collCache = { ts: 0, list: [] };
function refreshCollections() {
  return new Promise(res => {
    const ev = 'print(JSON.stringify(db.getCollectionNames().map(function(c){return {name:c,n:db.getCollection(c).estimatedDocumentCount()};})))';
    const ch = spawn('ssh', ['mint', `mongosh ${MONGO_DB} --quiet --eval '${ev}'`]);
    let out = ''; ch.stdout.on('data', d => out += d);
    ch.on('close', () => { try { collCache = { ts: Date.now(), list: JSON.parse(out.trim()) }; } catch {} res(); });
    ch.on('error', () => res());
  });
}

const page = () => `<!doctype html><html><head><meta charset=utf-8><title>Domestication — batches & figures</title>
<style>
 body{font:14px system-ui,Segoe UI,sans-serif;margin:0;background:#0f1115;color:#e6e6e6}
 header{position:sticky;top:0;z-index:10;background:#161a20;border-bottom:1px solid #2a2f38;padding:10px 18px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
 h1{font-size:16px;margin:0} h2{font-size:14px;color:#9fb3c8;margin:24px 18px 8px;font-weight:600}
 .muted{color:#8a93a0} .k{display:inline-block;min-width:74px;margin-right:12px}
 .bar{height:8px;background:#222a33;border-radius:4px;flex:1;min-width:160px;overflow:hidden}.bar>div{height:100%;background:#3a7;transition:width .4s}
 .fig{background:#fff;display:inline-block;margin:0 18px 10px;border-radius:6px;padding:6px}.fig svg{display:block}
 .tcard{display:inline-block;width:228px;margin:0 14px 10px;vertical-align:top}.tcard .lbl{display:flex;justify-content:space-between;font-size:12px}
 .mini{height:8px;background:#222a33;border-radius:4px;margin:3px 0;overflow:hidden}.mini>div{height:100%;background:#48c;transition:width .4s}
 .missing{color:#888;padding:24px;margin:0 18px} a{color:#6cf}
 .cols{display:flex;gap:22px;align-items:flex-start;margin:0 18px}.left{flex:1;min-width:0}.right{width:330px;flex-shrink:0}
 .cols h2{margin-left:0;margin-right:0}
 table{border-collapse:collapse;width:100%;margin-top:6px}td,th{padding:4px 8px;text-align:left;border-bottom:1px solid #222a33;font-size:12px}th{color:#7d8794;font-weight:600}
 .pb{height:9px;background:#222a33;border-radius:3px;width:100px;display:inline-block;vertical-align:middle}.pb>div{height:100%;background:#48c;border-radius:3px}
 .pill{padding:1px 6px;border-radius:8px;font-size:11px}.bg{background:#173}.by{background:#751}.br{background:#811}
 #btbl tr{cursor:pointer}#btbl tr:hover td{background:#1b2028}#btbl tr.sel td{background:#1e2b22}
 .badge{font-size:10px;padding:1px 5px;border-radius:6px;margin-left:6px}.live{background:#173;color:#9f9}.view{background:#245;color:#9cf}
</style></head><body>
<header>
 <h1>Domestication</h1>
 <a href="/paper" style="color:#6cf;text-decoration:none;font-weight:600">Paper figures →</a>
 <span id=counts class=muted>loading…</span>
 <div class=bar><div id=prog style=width:0%></div></div>
 <span id=eta class=muted></span>
 <span id=figago class=muted></span>
</header>
<div class=cols>
 <div class=right>
  <h2>Batches <span id=bago class=muted style=font-size:11px></span></h2>
  <table id=btbl><thead><tr><th>collection<th style=text-align:right>docs</tr></thead><tbody><tr><td colspan=2 class=muted>loading…</td></tr></tbody></table>
 </div>
 <div class=left>
  <h2>Run progress by type <span class=muted style=font-size:11px>(live batch: ${ACTIVE_COLL})</span></h2><div id=bytype class=muted style="padding:0 4px">…</div>
  <div class=cols style=margin:0>
   <div class=left><h2>Workers <span id=wcount class=muted style=font-size:12px></span></h2><table id=wt><thead><tr><th>w<th>host<th>run<th>progress<th>on&nbsp;run<th>beat</tr></thead><tbody></tbody></table></div>
   <div class=right><h2>Recent</h2><table id=rt><thead><tr><th>run<th>host<th>dur<th>t/s</tr></thead><tbody></tbody></table></div>
  </div>
 </div>
</div>
<h2>Run viewer <span class=muted style=font-size:11px>— pick a setting → every distribution, aggregated over its reps</span></h2>
<div style="margin:0 18px 8px"><select id=setsel style="font-size:13px;padding:5px;background:#161a20;color:#e6e6e6;border:1px solid #2a2f38;border-radius:4px;min-width:520px;max-width:90vw"><option value="">loading settings…</option></select></div>
<div id=setfig></div>
<h2>Batch figures — <span id=vcoll>${ACTIVE_COLL}</span></h2>
<div id=figs></div>
<script>
var viewedColl=${JSON.stringify(ACTIVE_COLL)}, lastVer=null;
function fmt(s){if(s==null||s==='')return'-';s=+s;var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+'h':'')+(m?m+'m':'')+x+'s';}
function beat(a){return a<30?'bg':a<90?'by':'br';}
function mach(h){return h.indexOf('Media')>=0?'Mint':'Main';}
function setViewed(name){viewedColl=name;lastVer=null;document.getElementById('vcoll').textContent=name;document.getElementById('figs').innerHTML='<div class=missing>loading '+name+'…</div>';document.getElementById('setfig').innerHTML='';document.getElementById('setsel').value='';drawBatches();pollFigs();pollSettings();}
var batches=[];
function drawBatches(){
 document.querySelector('#btbl tbody').innerHTML=batches.map(function(b){
  var badge=(b.name===${JSON.stringify(ACTIVE_COLL)}?'<span class="badge live">live</span>':'')+(b.name===viewedColl?'<span class="badge view">viewing</span>':'');
  return '<tr class="'+(b.name===viewedColl?'sel':'')+'" onclick="setViewed('+JSON.stringify(b.name)+')"><td>'+b.name+badge+'<td style=text-align:right>'+b.n+'</tr>';}).join('')||'<tr><td colspan=2 class=muted>none</td></tr>';
}
async function pollCollections(){
 try{var c=await (await fetch('/collections')).json();batches=c.sort(function(a,b){return b.n-a.n});drawBatches();document.getElementById('bago').textContent='('+batches.length+')';}catch(e){}
}
async function pollRuns(){
 try{var s=await (await fetch('${COORD}/status')).json();var c=s.counts,pct=c.total?Math.round(100*c.done/c.total):0;
  document.getElementById('counts').innerHTML='<span class=k>done '+c.done+'/'+c.total+'</span><span class=k>run '+c.running+'</span><span class=k>pend '+c.pending+'</span>'+(c.error?'<span class=k style=color:#e88>err '+c.error+'</span>':'');
  document.getElementById('prog').style.width=pct+'%';
  document.getElementById('eta').textContent=s.etaSec?'ETA '+fmt(s.etaSec):'';
  document.getElementById('bytype').innerHTML=(s.byType||[]).map(function(t){var p=t.total?Math.round(100*t.done/t.total):0;
   return '<div class=tcard><div class=lbl><b>'+t.type+'</b><span class=muted>'+t.done+'/'+t.total+' ('+p+'%)</span></div><div class=mini><div style=width:'+p+'%></div></div><span class=muted style=font-size:11px>'+(t.running?'run '+t.running+' · ':'')+'pend '+t.pending+(t.error?' · err '+t.error:'')+'</span></div>';}).join('')||'<span class=muted>no runs yet</span>';
  document.getElementById('wcount').textContent=s.workers.length+' active'+(s.offlineWorkers?', '+s.offlineWorkers+' finished':'');
  document.querySelector('#wt tbody').innerHTML=s.workers.map(function(w){var wn=w.worker.split('-').slice(-1)[0];
   if(w.switching)return '<tr><td>'+wn+'<td>'+mach(w.host)+'<td colspan=3><span class=muted>switching…</span><td><span class="pill bg">'+w.age+'s</span></tr>';
   var p=w.totalTicks?Math.round(100*w.tick/w.totalTicks):0;
   return '<tr><td>'+wn+'<td>'+mach(w.host)+'<td>'+(w.runId||'<span class=muted>idle</span>')+'<td><span class=pb><div style=width:'+p+'%></div></span> '+p+'%<td>'+fmt(w.onRunSec)+'<td><span class="pill '+beat(w.age)+'">'+w.age+'s</span></tr>';}).join('')||'<tr><td colspan=6 class=muted>no active workers</td></tr>';
  document.querySelector('#rt tbody').innerHTML=(s.recent||[]).map(function(r){return '<tr><td>'+r.id+'<td>'+mach(r.host)+'<td>'+fmt(r.durationMs?Math.round(r.durationMs/1000):null)+'<td>'+(r.tps||'-')+'</tr>';}).join('');
 }catch(e){document.getElementById('counts').textContent='coordinator offline';}
}
async function pollFigs(){
 try{var f=await (await fetch('/figs?coll='+encodeURIComponent(viewedColl))).json();
  document.getElementById('figago').textContent='figures '+(Math.round(Date.now()/1000)-f.version)+'s old';
  if(f.version===lastVer)return; lastVer=f.version;
  var html=(f.collapse?'<section><h2>Collapse — domestication vs lineage divergence</h2><div class=fig style="margin:0 18px">'+f.collapse+'</div></section>':'')+f.sweeps.map(function(x){return '<section><h2>'+x.cap+'</h2><div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;margin:0 18px">'+
   '<div><div style="font-size:11px;color:#9fb3c8;margin:0 0 4px 2px">domestication (dome, corrected)</div><div class=fig style=margin:0>'+x.svg+'</div></div>'+
   '<div><div style="font-size:11px;color:#9fb3c8;margin:0 0 4px 2px">lineage divergence (TV distance, planted vs harvested gsp)</div><div class=fig style=margin:0>'+x.div+'</div></div>'+
   '</div></section>';}).join('');
  if(f.paper&&f.paper.length){html+='<h2 style="margin-top:28px">Experiments — distributions ('+f.paper.length+')</h2>'+f.paper.map(function(x){return '<div class=fig>'+x.svg+'</div>';}).join('');}
  document.getElementById('figs').innerHTML=html;
 }catch(e){}
}
async function pollSettings(){try{var a=await (await fetch('/settings?coll='+encodeURIComponent(viewedColl))).json();var sel=document.getElementById('setsel');var cur=sel.value;sel.innerHTML='<option value="">— pick a run / setting ('+a.length+' with data) —</option>'+a.map(function(s){return '<option value="'+encodeURIComponent(s.key)+'">'+s.label+'  (n='+s.n+(s.dome!=null?', dome '+s.dome:'')+')</option>';}).join('');if(cur)sel.value=cur;}catch(e){}}
document.getElementById('setsel').addEventListener('change',function(){var k=this.value;if(!k){document.getElementById('setfig').innerHTML='';return;}document.getElementById('setfig').innerHTML='<div class=missing>rendering…</div>';fetch('/setting?coll='+encodeURIComponent(viewedColl)+'&key='+k).then(function(r){return r.text()}).then(function(svg){document.getElementById('setfig').innerHTML='<div class=fig>'+svg+'</div>';}).catch(function(){document.getElementById('setfig').innerHTML='<div class=missing>error</div>';});});
pollCollections();setInterval(pollCollections,60000);
pollRuns();setInterval(pollRuns,2000);
pollFigs();setInterval(pollFigs,15000);
pollSettings();setInterval(pollSettings,60000);
</script></body></html>`;

const paperPage = (coll) => `<!doctype html><html><head><meta charset=utf-8><title>Paper figures — ${coll}</title>
<style>
 body{font:14px system-ui,Segoe UI,sans-serif;margin:0;background:#0f1115;color:#e6e6e6}
 header{position:sticky;top:0;z-index:10;background:#161a20;border-bottom:1px solid #2a2f38;padding:10px 20px;display:flex;gap:16px;align-items:center}
 h1{font-size:16px;margin:0} a{color:#6cf;text-decoration:none}
 button{background:#245;color:#cfe;border:1px solid #37506e;border-radius:5px;padding:5px 11px;cursor:pointer;font:inherit;font-size:12px}
 button:hover{background:#2c5f8f}
 h2.sec{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#9fb3c8;margin:34px 20px 4px;border-bottom:1px solid #2a2f38;padding-bottom:6px}
 .figblock{margin:18px 20px 30px;max-width:1180px}
 .fignum{font-size:11.5px;color:#7d8794;font-weight:700;letter-spacing:.03em}
 .figttl{font-size:15px;font-weight:700;margin:2px 0 8px;color:#eef2f6}
 .card{background:#fff;border-radius:6px;padding:8px;display:inline-block;max-width:100%;overflow-x:auto}
 .card img{display:block;max-width:100%;height:auto}
 .cap{font-size:12.5px;color:#b3bdc7;margin-top:9px;line-height:1.55;max-width:940px}
 .pair{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
 .pair .lab{font-size:11px;color:#9fb3c8;margin:0 0 4px 2px}
 .muted{color:#8a93a0}
</style></head><body>
<header><h1>Paper figures</h1><a href="/">← dashboard</a><span class=muted id=coll>${coll}</span><button onclick="regen()">↻ regenerate from data</button><span class=muted id=ago></span></header>
<div id=root class=muted style="padding:24px 20px">loading…</div>
<script>
var COLL=${JSON.stringify(coll)};
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function png(f){return '/finalpng?coll='+encodeURIComponent(COLL)+'&f='+encodeURIComponent(f)}
async function regen(){document.getElementById('ago').textContent=' · regenerating (matplotlib — ~1 min)…';await fetch('/regenpaper?coll='+encodeURIComponent(COLL),{method:'POST'});setTimeout(load,6000);}
async function load(){
 try{var m=await (await fetch('/paperfigs?coll='+encodeURIComponent(COLL))).json();
  document.getElementById('ago').textContent=m.mtime?(' · generated '+(Math.round(Date.now()/1000)-m.mtime)+'s ago'):'';
  var figs=m.figs||[], n=0, html='';
  if(!figs.length){document.getElementById('root').innerHTML='<div style="padding:24px 20px" class=muted>No figures yet — click “regenerate from data”.</div>';return;}
  var dist=figs.filter(function(f){return f.group==='dist'}), sw=figs.filter(function(f){return f.group==='sweep'}), col=figs.filter(function(f){return f.group==='collapse'});
  html+='<h2 class=sec>Gene distributions</h2>';
  dist.forEach(function(x){n++;html+='<div class=figblock><div class=fignum>FIGURE '+n+'</div><div class=figttl>'+esc(x.title)+'</div><div class=card><img src="'+png(x.png)+'"></div><div class=cap>'+esc(x.caption)+'</div></div>';});
  if(sw.length){html+='<h2 class=sec>Parameter sweeps — sensitivity (population × parameter)</h2>';
   sw.forEach(function(x){n++;html+='<div class=figblock><div class=fignum>FIGURE '+n+'</div><div class=figttl>'+esc(x.title)+'</div><div class=card><img src="'+png(x.png)+'"></div><div class=cap>'+esc(x.caption)+'</div></div>';});}
  col.forEach(function(x){n++;html+='<h2 class=sec>The collapse</h2><div class=figblock><div class=fignum>FIGURE '+n+'</div><div class=figttl>'+esc(x.title)+'</div><div class=card><img src="'+png(x.png)+'"></div><div class=cap>'+esc(x.caption)+'</div></div>';});
  document.getElementById('root').innerHTML=html;
 }catch(e){document.getElementById('root').textContent='error: '+e.message;}
}
load();
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/paper') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(paperPage(u.searchParams.get('coll') || ACTIVE_COLL)); }
  if (u.pathname === '/paperfigs') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(readFinal(u.searchParams.get('coll') || ACTIVE_COLL)));
  }
  if (u.pathname === '/finalpng') {
    const coll = u.searchParams.get('coll') || ACTIVE_COLL, f = path.basename(u.searchParams.get('f') || '');
    const p = path.join(HERE, 'data', coll, 'final', f);
    if (f.endsWith('.png') && fs.existsSync(p)) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(fs.readFileSync(p)); }
    res.writeHead(404); return res.end('not found');
  }
  if (u.pathname === '/regenpaper' && req.method === 'POST') {
    const coll = u.searchParams.get('coll') || ACTIVE_COLL;
    spawn('node', [path.join(HERE, 'regen-paper.mjs'), coll], { cwd: HERE, detached: true, stdio: 'ignore' }).unref();
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ started: true }));
  }
  if (u.pathname === '/collections') {
    if (Date.now() - collCache.ts > 60000) await refreshCollections();
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(collCache.list));
  }
  if (u.pathname === '/settings') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(settingsFor(u.searchParams.get('coll') || ACTIVE_COLL)));
  }
  if (u.pathname === '/setting') {
    const svg = await renderSetting(u.searchParams.get('coll') || ACTIVE_COLL, u.searchParams.get('key') || '');
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(svg);
  }
  if (u.pathname === '/figs') {
    const coll = u.searchParams.get('coll') || ACTIVE_COLL;
    const c = figCache[coll];
    if (!c || Date.now() - c.ts > 15000) await regen(coll);
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(readFigs(coll)));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page());
});
server.listen(PORT, '0.0.0.0', () => console.log(`figures on http://localhost:${PORT}/  (batch viewer; active=${ACTIVE_COLL})`));
regen(ACTIVE_COLL); setInterval(() => regen(ACTIVE_COLL), 120000);   // dome heatmaps refresh every 2 min (heavy figs self-throttle to 15 min inside regen)
refreshCollections(); setInterval(refreshCollections, 60000);
