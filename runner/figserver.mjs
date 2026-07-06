// figserver.mjs — one page with all our figures, auto-refreshing. Port 8089.
// Regenerates the SVGs from current results on a timer (fast, no headless browser),
// inlines them into a single page, and shows live run counts from the coordinator.
// Usage: node figserver.mjs   (PORT env, default 8089; COORD env, default :8088)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '8089');
const COORD = process.env.COORD ?? 'http://localhost:8088';

// figures derive from the live Mongo collection (pull -> aggregate -> render)
const COLL = process.env.COLL || 'domestication-final-2026';
const FIGDIR = path.join(HERE, 'data', COLL);
const FIGS = [
  { svg: 'fig_pp.svg',        cap: 'Planting effort × population (corrected)' },
  { svg: 'fig_saved.svg',     cap: 'saved% × population (corrected)' },
  { svg: 'fig_selective.svg', cap: 'selective% × population (corrected)' },
  { svg: 'fig_energy.svg',    cap: 'energy × population (corrected)' },
];

let lastRegen = 0, regenerating = false;
function run(args) {
  return new Promise(res => { const ch = spawn('node', [path.join(HERE, args[0]), ...args.slice(1)], { cwd: HERE });
    ch.on('close', () => res()); ch.on('error', () => res()); });
}
async function regen() {                                  // pull the Mongo aggregate, then render the sweep figs
  if (regenerating) return; regenerating = true;
  try { await run(['pull.mjs', COLL]); await run(['mongo-figs.mjs', COLL]); lastRegen = Date.now(); }
  finally { regenerating = false; }
}

const page = () => `<!doctype html><html><head><meta charset=utf-8><title>Domestication — runs & figures</title>
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
</style></head><body>
<header>
 <h1>Domestication</h1>
 <span id=counts class=muted>loading…</span>
 <div class=bar><div id=prog style=width:0%></div></div>
 <span id=eta class=muted></span>
 <span id=figago class=muted></span>
</header>
<h2>Run progress by type</h2><div id=bytype class=muted style="padding:0 4px">…</div>
<div class=cols>
 <div class=left><h2>Workers <span id=wcount class=muted style=font-size:12px></span></h2><table id=wt><thead><tr><th>w<th>host<th>run<th>progress<th>on&nbsp;run<th>beat</tr></thead><tbody></tbody></table></div>
 <div class=right><h2>Recent completions</h2><table id=rt><thead><tr><th>run<th>host<th>dur<th>t/s</tr></thead><tbody></tbody></table></div>
</div>
<div id=figs></div>
<script>
var lastVer=null;
function fmt(s){if(s==null||s==='')return'-';s=+s;var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+'h':'')+(m?m+'m':'')+x+'s';}
function beat(a){return a<30?'bg':a<90?'by':'br';}
function mach(h){return h.indexOf('Media')>=0?'Mint':'Main';}
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
 try{var f=await (await fetch('/figs')).json();
  document.getElementById('figago').textContent='figures '+(Math.round(Date.now()/1000)-f.version)+'s old';
  if(f.version===lastVer)return; lastVer=f.version;                       // swap only when changed -> no flicker, scroll kept
  var html=f.sweeps.map(function(x){return '<section><h2>'+x.cap+'</h2><div class=fig>'+x.svg+'</div></section>';}).join('');
  if(f.paper&&f.paper.length){html+='<h2 style="margin-top:28px">Paper experiments — gene distributions ('+f.paper.length+')</h2>'+f.paper.map(function(x){return '<div class=fig>'+x.svg+'</div>';}).join('');}
  document.getElementById('figs').innerHTML=html;
 }catch(e){}
}
pollRuns();setInterval(pollRuns,2000);
pollFigs();setInterval(pollFigs,15000);
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/figs') {                              // figures as JSON; the page swaps them in place
    if (Date.now() - lastRegen > 15000) await regen();
    const sweeps = FIGS.map(f => { const p = path.join(FIGDIR, f.svg); return { cap: f.cap, svg: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '<div class=missing>pending…</div>' }; });
    let paper = [];
    const mp = path.join(FIGDIR, 'paper-manifest.json');
    if (fs.existsSync(mp)) paper = JSON.parse(fs.readFileSync(mp, 'utf8')).map(e => { const p = path.join(FIGDIR, e.svg); return { id: e.id, svg: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '' }; });
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ version: Math.round(lastRegen / 1000), sweeps, paper }));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page());
});
server.listen(PORT, '0.0.0.0', () => console.log(`figures on http://localhost:${PORT}/  (regen every 30s)`));
regen();
setInterval(regen, 30000);
let regeningPaper = false;
async function regenPaper() { if (regeningPaper) return; regeningPaper = true; try { await run(['paper-figs.mjs', COLL]); } finally { regeningPaper = false; } }
regenPaper();
setInterval(regenPaper, 300000);   // paper figs pull full docs — heavier, every 5 min
