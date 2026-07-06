// stats.mjs — per-setting statistics for the replicate/sufficiency analysis.
// Splits the conflated dome metric into the two regimes: establishment probability
// p(ignite) [binomial] and degree level|ignite [continuous]. Decides whether the
// replicate count is sufficient (both CIs within target) and how many more are needed.

const Z = 1.96;
// two-sided t for 95% CI (df -> t.975); 1.96 beyond df=30
const TT = [12.71,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
export const tcrit = n => n <= 1 ? Infinity : (n - 1 <= 30 ? TT[n - 2] : Z);

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1)) : 0;

// evaluate a set of replicate dome values for one setting
export function evaluate(vals, { thr = 0.1, eLevel = 0.02, eP = 0.10 } = {}) {
  const n = vals.length;
  if (n === 0) return { n: 0, regime: 'nodata', p: 0, pCIhalf: Infinity, pCenter: 0,   // never count a no-data setting as done
    level: 0, levelSd: 0, levelCIhalf: Infinity, conflatedMean: 0, enough: false, nNeeded: 5 };
  const ign = vals.filter(v => v > thr), nIgn = ign.length;
  const p = n ? nIgn / n : 0;
  // Wilson 95% CI for p(ignite)
  const wCenter = (p + Z * Z / (2 * n)) / (1 + Z * Z / n);
  const wHalf = (Z * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n))) / (1 + Z * Z / n);
  // level | ignite, t-CI
  const lMean = nIgn ? mean(ign) : 0, lSd = nIgn ? sd(ign) : 0;
  const lHalf = nIgn > 1 ? tcrit(nIgn) * lSd / Math.sqrt(nIgn) : Infinity;   // undefined CI from <2 points
  const overall = n ? mean(vals) : 0;

  const regime = p >= 0.95 ? 'interior' : p <= 0.05 ? 'wild' : 'boundary';
  const pOK = regime !== 'boundary' || wHalf <= eP;            // p only needs a tight CI at the boundary
  const lvlOK = p <= 0.05 ? true : lHalf <= eLevel;            // level matters wherever anything ignites
  const enough = pOK && lvlOK;
  const nP = regime === 'boundary' ? Math.ceil((Z / eP) ** 2 * Math.max(p * (1 - p), 0.05)) : 0;
  const nL = (p > 0.05 && lHalf > eLevel) ? Math.ceil((tcrit(Math.max(nIgn, 2)) * lSd / eLevel) ** 2) : 0;
  const nNeeded = enough ? n : Math.max(nP, nL, n + 1);

  return { n, regime, p, pCIhalf: wHalf, pCenter: wCenter, level: lMean, levelSd: lSd, levelCIhalf: lHalf,
           conflatedMean: overall, enough, nNeeded };
}
