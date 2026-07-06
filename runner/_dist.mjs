import fs from 'node:fs';
const genes = [['weight','weightData'],['deepRoots','rootData'],['fecundity','seedData'],['dispersal','dispersalData']];
const last = a => a && a.length ? a[a.length-1] : null;
const meanOf = h => { let n=0,s=0; for(let i=0;i<h.length;i++){n+=h[i]; s+=h[i]*((i+0.5)/20);} return n? s/n : 0; };
function grab(file) {
  const r = JSON.parse(fs.readFileSync(file,'utf8')); const d = r.data;
  const o = { pop:last(d.seedPop), wild:last(d.wildSeedPop), dome:last(d.domeSeedPop), genes:{} };
  for (const [name,key] of genes) o.genes[name] = { all:last(d[key]), mean:meanOf(last(d[key])) };
  return o;
}
const A = grab('outA_humans.json'), B = grab('outB_nohumans.json');
console.log('metric            A(humans)   B(no humans)');
console.log('seedPop           '+A.pop+'        '+B.pop);
console.log('domeFrac          '+(A.dome/A.pop).toFixed(3)+'       '+(B.dome/B.pop).toFixed(3));
for (const [name] of genes) console.log((name+' mean').padEnd(18)+A.genes[name].mean.toFixed(3)+'       '+B.genes[name].mean.toFixed(3));
fs.writeFileSync('_distdata.json', JSON.stringify({A,B}));
console.log('\nwrote _distdata.json');
