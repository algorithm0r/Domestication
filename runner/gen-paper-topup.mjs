// gen-paper-topup.mjs — bring each paper-experiment (histogram / gene-distribution) run up to
// n=10 replicates. These are the "selection runs" that test the hypothesis (p01–p21 + lin_*),
// including the wild-type controls (p01/p02/p03). Aggregation is by settingKey(config), so we
// emit extra reps with the EXACT settings.json config; they pool into the existing histogram.
// Continues the _rNN sequence from the current count. Idempotent: coordinator dedups by id.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const TARGET = 10;
const settings = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'domestication-final-2026', 'paper-manifest.json'), 'utf8'));
const nById = Object.fromEntries(manifest.map(m => [m.id, m.n]));
const paper = settings.filter(s => /^p\d\d_/.test(s.id) || /^lin_/.test(s.id));
const p2 = v => String(v).padStart(2, '0');

const runs = [];
for (const s of paper) {
  const have = nById[s.id] ?? 0;
  for (let i = have + 1; i <= TARGET; i++) runs.push({ id: `${s.id}_r${p2(i)}`, config: s.config });
}

const summary = paper.map(s => `${s.id}:${nById[s.id] ?? 0}->${Math.max(nById[s.id] ?? 0, TARGET)}`);
console.log(summary.join('  '));
console.log(`built ${runs.length} paper-topup runs across ${paper.length} experiments (target n=${TARGET})`);
const COORD = process.env.COORD ?? 'http://localhost:8088';
const res = await fetch(COORD + '/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs }) });
console.log('enqueue ->', JSON.stringify(await res.json()));
