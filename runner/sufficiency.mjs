// sufficiency.mjs <setting-prefix> [thr] [eLevel] [eP] — evaluate replicates of ONE
// setting and decide whether we have enough runs (the adaptive stopping rule).
//
// Splits the conflated dome metric into the two regimes we found:
//   p_ignite        = fraction of runs where domestication established (dome > thr)  [binomial]
//   level|ignite    = mean dome AMONG runs that established                          [continuous]
// Reports 95% CIs for both (Wilson for the proportion, t for the level) and whether
// each is within its target half-width. "enough" = both tight (only the relevant one
// matters in a clear regime). Prints N_needed so an adaptive loop can top up.
//
// Usage: node sufficiency.mjs vol_pop100_pl80            (defaults thr=0.1 eLevel=0.02 eP=0.1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const PREFIX = process.argv[2];
const THR    = parseFloat(process.argv[3] ?? '0.1');    // dome above this = "domestication established"
const E_LVL  = parseFloat(process.argv[4] ?? '0.02');   // target 95% CI half-width on level
const E_P    = parseFloat(process.argv[5] ?? '0.10');   // target 95% CI half-width on p_ignite
if (!PREFIX) { console.error('usage: node sufficiency.mjs <setting-prefix> [thr] [eLevel] [eP]'); process.exit(1); }

// two-sided t for 95% CI (df -> t.975); 1.96 beyond df=30
const TT = [12.71,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
const tcrit = n => n <= 1 ? Infinity : (n - 1 <= 30 ? TT[n - 2] : 1.96);
const Z = 1.96;

function dome(file) {
  try { const o = JSON.parse(fs.readFileSync(file, 'utf8')), d = o.data, n = d.seedPop.length, st = Math.floor(n * 0.67);
    let dm = 0, c = 0; for (let i = st; i < n; i++) if (d.seedPop[i] > 0) { dm += d.domeSeedPop[i] / d.seedPop[i]; c++; }
    return c ? dm / c : null; } catch { return null; }
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1)) : 0;

// collect replicate dome values for this setting
const dir = path.join(HERE, 'results');
const files = fs.readdirSync(dir).filter(f => f.startsWith(PREFIX) && /_r\d+\.json$/.test(f));
const vals = files.map(f => dome(path.join(dir, f))).filter(v => v != null);
if (!vals.length) { console.log(`${PREFIX}: no replicate files (looking for ${PREFIX}*_rNN.json)`); process.exit(0); }

const n = vals.length;
const ign = vals.filter(v => v > THR), nIgn = ign.length;
const p = nIgn / n;
// Wilson 95% CI for the proportion
const wCenter = (p + Z * Z / (2 * n)) / (1 + Z * Z / n);
const wHalf = (Z * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n))) / (1 + Z * Z / n);
// level | ignite: t-CI
const lMean = nIgn ? mean(ign) : 0, lSd = nIgn ? sd(ign) : 0, lHalf = nIgn ? tcrit(nIgn) * lSd / Math.sqrt(nIgn) : Infinity;
const overall = mean(vals);

// regime + sufficiency
const regime = p >= 0.95 ? 'interior (p≈1)' : p <= 0.05 ? 'wild (p≈0)' : 'BOUNDARY';
const pOK = regime !== 'BOUNDARY' || wHalf <= E_P;            // proportion only needs tight CI at the boundary
const lvlOK = p <= 0.05 ? true : lHalf <= E_LVL;              // level matters wherever anything ignites
const enough = pOK && lvlOK;
// N_needed
const nP = regime === 'BOUNDARY' ? Math.ceil((Z / E_P) ** 2 * Math.max(p * (1 - p), 0.05)) : 0;
const nL = (p > 0.05 && lHalf > E_LVL) ? Math.ceil((tcrit(Math.max(nIgn, 2)) * lSd / E_LVL) ** 2) : 0;

console.log(`\n${PREFIX}   (n=${n} replicates, threshold dome>${THR})`);
console.log(`  regime:            ${regime}`);
console.log(`  p(ignite):         ${p.toFixed(3)}   95% CI ±${wHalf.toFixed(3)}  ${pOK ? '✓' : '✗ need ±' + E_P}`);
console.log(`  level | ignite:    ${lMean.toFixed(4)} ± ${lSd.toFixed(4)} (SD), 95% CI ±${lHalf.toFixed(4)}  ${lvlOK ? '✓' : '✗ need ±' + E_LVL}  [n=${nIgn}]`);
console.log(`  conflated mean:    ${overall.toFixed(4)}   (= p × level, the old single number)`);
console.log(`  ENOUGH? ${enough ? 'YES — stop' : 'NO'}`);
if (!enough) console.log(`  N needed: ${Math.max(nP, nL, n + 1)} total  (proportion→${nP || '-'}, level→${nL || '-'})`);
