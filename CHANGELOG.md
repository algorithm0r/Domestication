# Simulation Change Log

Running record of every change to the simulation code and repository made during the
major revision of the paper *"Domestication through unintentional selective planting in
artificial cereal grains"* (Artificial Life, ARTL-2026-0060), for the reviewers.

Reviewer comment IDs (e.g. `R1.BUG1`, `R2.16`) index the review comments; each entry
below restates the comment briefly so this file is self-contained.

**Entry format**

```
### [DATE] Short title  — addresses: R?.?  — status
- Change: what changed
- Location: file:line(s)
- Commit: <hash>
- Notes: rationale, evidence
```

Status: DONE · IN PROGRESS · PENDING

---

## [2026-06-24] Repository reconciliation & version tag — addresses: R1.12 — DONE
- Change: Brought the local journal-version working tree (which was ahead of GitHub and
  held the journal experiment data) onto GitHub's canonical history, and tagged the exact
  snapshot used for the submission.
- Commits: `f381e5a` (journal code: seed.js predation, util.js run configs + IP,
  gameengine.js timestep, histogram.js), `e62e13b` (journal experiment data).
- Tag: **`paper-ARTL-2026-0060`** = exact code + configuration + data used for the paper.
- Notes: The local-only `data/jounral (tainted data)/` set is excluded via `.gitignore`.
  Directly answers R1.12 (pointer to the exact version used). Run configurations live in
  `util.js` (`runs`), which also begins to address R1.13.

## [2026-06-24] Bug #1 — dormant-seed duplication — addresses: R1.BUG1 — FIX APPLIED (awaiting new-run confirmation)
- Comment: `cell.js` `germinate()` never removes the chosen seed from the dormant queue
  (the `splice` at `cell.js:46` is commented out), so the same Seed object can be pushed
  into `board.seeds` multiple times.
- Investigation: built a headless measurement harness (loads the real model, seeded RNG,
  instruments `germinate`, drives `board.update()` directly) to quantify how often the bug
  fires and whether it distorts reported distributions. Harness is a separate tool, not in
  this repo.
- Findings (wild-type, no-humans baseline; 3 seeds × 30k ticks, 81 samples each; results
  stable to ±0.001 across seeds):
  - **Fires frequently:** **24.2%** of germinations re-select a seed already active in the
    cell (duplicate reference); **2.1%** resurrect an already-dead seed.
  - **Standing duplication:** **14.0%** of `board.seeds` entries are duplicate references
    (raw population ≈8,560 vs ≈7,363 distinct seeds).
  - **Census artifact is negligible:** counting each seed once instead of per-occurrence
    shifts the wild/domesticated split by **0.0002**, the dispersal histogram by **0.003**/bucket,
    and the root-depth histogram by **0.016**/bucket (the largest — mildly correlated with the
    duplication). The duplication is essentially genotype-neutral.
- Fix identified & verified in-harness: re-enable the splice (consume the germinated dormant
  entry, by its known index). With the fix, measured duplication → **exactly 0**. The fix is
  correct but **not results-neutral on magnitudes**: removing the premature multi-update aging
  raises the true distinct population ~8% (≈7,370 → ≈7,940) and shifts the wild/dome split by
  ~1.5 pp (dynamical effect, distinct from the ~0.0002 pure-census artifact above). Normalized
  distributions move only slightly either way.
- **Fix APPLIED** to `cell.js:43–46` (commit `66cba35`): splice the germinated dormant entry
  by its drawn index. Duplication → 0.
- Controlled A/B confirmation (headless, seed 12345, fixed vs unfixed, same RNG stream):
  - Wild (30k ticks): dome split Δ 0.0006, dispersal hist Δ ≤0.0023/bucket, root-depth Δ ≤0.0145/bucket.
  - Plant (harvest-random / plant-first-harvested, 40k ticks): dome split Δ 0.0009, dispersal
    hist Δ ≤0.0027/bucket, root-depth Δ ≤0.0196/bucket; distribution *shapes* visually identical.
  - Conclusion: the fix is correct and conclusion-neutral. NB these are scaled measurement
    proxies (1 seed, 30–40k ticks, planting `humanAddRate` 40), **not** paper-scale runs
    (150k ticks, 100-run ensemble, real data pipeline).
- DEFINITIVE confirmation: the paper's figures will be **regenerated from new full runs with
  the fixed code** (decision 2026-06-24), rather than arguing the old figures are unchanged.
  This also serves R1.4 (run variability) and the sensitivity analysis (R2.13/R2.14).

## [2026-06-24] Bug #2 — human double-move & free-drinking — addresses: R1.BUG2 — INTENDED (no code change)
- Comment: `human.js:604–609` has no `else` between the seed-move and water-move branches, so a
  human needing both relocates twice in one tick (harvest + water).
- Analysis: both `moveToSeeds` and `moveToWater` relocate the human, but only `moveToSeeds`
  harvests (`pluckSeeds`) — so harvesting is still **once per tick**, not doubled. Separately,
  the `shelter.water > 0` drink-gate in `rest()` (`human.js:122`) is commented out, so thirst
  drops for free: **water is decoupled from human survival**. Net effect of the double-move is
  ~2× human *movement* (riverward drift) and always-active foragers — i.e. higher selection
  *magnitude / spatial reach*, not *direction*.
- **Author decision (2026-06-24): both behaviors are INTENDED.** Humans multitask per tick by
  design; water is deliberately not a survival constraint (metabolism only paces the work/rest
  cycle — humans never die, fixed population). **No code change.**
- Response plan: justify in the manuscript rather than "fix". The implied human throughput/effort
  is exactly what the new human-effort sensitivity analysis (R2.14) explores. Also drives prose
  clarifications: role of water (R2.10), per-tick human behavior (R2.2/R2.5), and the definition
  of a "day" (R1.8). NB the prose phrase "drinking from the resources gathered" (main.tex §Humans)
  overstates water's role and should be softened.

## [2026-06-25] Bug #3 — dry-cell growth / "weeds" — addresses: R1.BUG3 / R1.6 — NOT A BUG (no code change)
- Comment: `seed.js:31–33` — a shallow-root seed (deepRoots ≈ 0) in a fully-dry cell (water = −11)
  has `growthUnit = 0`, so `threshold`/`dropThreshold` = Infinity; flagged as "immortal seeds."
- Analysis: **"immortal" is false.** Such a seed never establishes (it cannot grow) and is removed
  naturally by `seedDeathChance` (~100-tick expected life); meanwhile it only occupies a cell slot —
  it does not grow or spread. This IS the intended **Wild Type III "weed" dynamic already reported**
  in the paper (§WT-III, `control.pdf` col 3): wet-variant (shallow-root) seeds carried by planting
  into the dry margins grow essentially not at all and clog the ground. The dry variant
  (deepRoots ≈ 1) has `growthUnit = range/2 = 8` in *every* cell, so it always grows/reproduces and
  never clogs — exactly the asymmetry **R1.6** asks about.
- **Author decision (2026-06-25): NOT a bug; no code change.** A non-bug surfaced by code-reading
  carries no obligation to respond, and the behavior is already correctly reported.
- Action (clarity only, in the manuscript): reference the growth-rate (`growthUnit`) formula in the
  §WT-III weeds discussion to show mechanism/intent; this also answers R1.6. Logged in the paper
  change log.

## [2026-06-25] Bug #4 — shelter-placement randomness — addresses: R1.BUG4 / R2.15 — DONE (parameterized)
- Comment: `automata.js:123` `randomInt(1)` always returns 0 and the `prob = 1` guard is always
  true, so the apparent randomness in shelter placement is dead code; shelters are deterministically
  the full left/right edge columns.
- Verdict: not a behavioral bug — edge shelters are intended and match the prose/figure.
- Action (commit `2efb022`): rather than expunge the vestige, exposed its intent — the hardcoded
  `prob` is now `params.shelterDensity = 1` (per-edge-cell shelter probability; < 1 would limit the
  number of shelters). **No behavior change.** The vestigial `randomInt(1)` is left intact by choice.
  Doubles as a documented parameter (R2.12) and a small codebase-clarity improvement (R2.15).

## [2026-06-27] New experiment — direct test of the planted-lineage hypothesis — addresses: R1.5 — DONE (counter design; mingsp/maxgsp enqueued)
<!-- Evolved through 3 designs: bottom+flag (ceiling artifact) -> random+flag (null) -> inherited gsp counter (works, ~0.52). See RESULT/RESOLUTION below. -->
- Motivation: the paper *hypothesizes* that domestication takes hold when humans reliably re-sow
  seeds from the lineage of previously-planted seeds, but demonstrates it only indirectly (via the
  realistic planting rules). This adds a direct mechanism test, converting the assertion into
  evidence (serves R1.5). It also bounds the realistic results between two idealized arms and maps
  onto the reproductive-isolation account of domestication (a cultivated line diverges only when
  gene flow from the wild stand is low).
- Design (author decision 2026-06-27, "plant-side"): each seed records how it entered the soil —
  `planted` (true only when a human sows it) — and each plucked grain records `fromPlanted` (was
  its parent plant sown). **Neither is inherited beyond that one step**, so the tag cannot
  accumulate/saturate. A new `params.plantLineage` restricts *replanting* to grain off a sown
  parent (`"planted"`, experimental) or a natural parent (`"natural"`, negative control), padding
  with the rest only when the matching pool is short (bootstrap). `"off"` (default) = unchanged.
- Code:
  - `seed.js` — constructor mints `planted=false`, `fromPlanted=false`; `pluckSeeds()` sets
    `grain.fromPlanted = parentPlant.planted`.
  - `cell.js` — `addSeed(seed, offset, planted)` tags the sown seed; natural fall / world-init
    callers pass nothing → `false`.
  - `human.js` — `cultivate()` sows with `planted=true`; `move()` adds a gated, stable
    front-partition of the basket by `fromPlanted` before the existing bottom-splice.
  - `util.js` — `plantLineage: "off"` default.
  - `runner/mongo.mjs` — `settingKey()` appends `|plantLineage=…` **only when not "off"**, so every
    pre-existing run in `domestication-final-2026` keeps its exact key (no batch regrouping).
  - `runner/gen-settings.mjs` — 2 new arms: `{planted,natural}` at pop 80 (the sweep sweet-spot
    anchor), energy-15; baseline = the existing all-planting anchor cell `pp_pop80_pl80`. (Scoped
    to pop 80 per author 2026-06-27; NB the 21 original paper experiments are at pop 100, the sweeps
    at the pop-80 optimum.)
- **Inertness of the default path:** the new `planted`/`fromPlanted` fields are read **only** inside
  the `plantLineage ∈ {planted,natural}` branch; with `"off"` that branch never runs and no new
  `Math.random()` is consumed on any path, so default behavior is unchanged by construction (the
  pending-but-unstarted runs in the live batch are unaffected).
- Functional check (LOCAL only — time-compressed single runs, epoch 45k / plantingTime 8k, pop 80;
  NOT written to Mongo): baseline `off` dome 0.490, `planted` 0.497, `natural` 0.440. All three ran
  clean; the negative control (`natural`) clearly suppresses domestication — the load-bearing
  result. `planted ≈ baseline` because the realistic all-planting anchor already re-sows mostly
  within its own line (near the idealized ceiling); the lineage restriction mainly bites in the
  negative direction. Full-scale 150k runs expected to sharpen the gap. Single noisy runs — a
  code/mechanism confirmation, not evidence by themselves.
- Full-scale confirmation (150k ticks, real timeline, pop 80, single rep each; LOCAL, not in Mongo):
  baseline 0.4902, planted 0.4918, **natural 0.4396**. Negative control suppresses domestication by
  **−0.051** vs baseline (~20× the interior-regime SD ~0.0025 — a real effect, not noise); planted ≈
  baseline (+0.0016, within noise) because the realistic all-planting anchor already re-sows mostly
  within its own line, i.e. it already sits at the planted ceiling. Conclusion: lineage continuity is
  the active mechanism; breaking it (natural-only) is what collapses domestication. Hypothesis
  supported.
- **DESIGN CORRECTION 2026-06-27 (supersedes the bottom-planting arms above).** Per author: the
  lineage arms must plant like a *standard neutral (random) paper experiment* — the ONLY
  seed-selection criterion is the planted-vs-natural flag, applied across the whole basket up to
  save%, with NO bottom/top harvest-order bias. So `plantStrategy` for the arms changes
  `bottom`→`random` (config-only; the flag-partition code is unchanged and already does this for
  random). The correct **baseline becomes `p03_wt3_plantrandom`** (random planting, no flag), which
  the arms now match exactly except `plantLineage`. Crucially this de-ceilings the test: under
  `bottom` the baseline already sat at ~0.49 (the planted ceiling), so `planted` couldn't rise;
  under random/neutral planting the planted arm has room to climb ABOVE baseline. New setting ids
  `lin_planted2_pop80` / `lin_natural2_pop80` (v1 `bottom` ids retired). The bottom full-scale
  numbers above stand only as: negative control real (natural suppresses); `planted≈baseline` was a
  ceiling artifact, not a null result.
- Cleanup: the 10 seeded bottom-arm runs (`lin_{planted,natural}_pop80_r0[1-5]`) were all still
  PENDING and were cancelled via `/error` (no compute wasted, no orphan data). Both adaptive daemons
  were stopped (the new-arms one AND the main-batch one, which still held the old pop-100 settings) —
  the batch keeps running off the coordinator queue; **all top-ups deferred to one manual end-pass**
  (see memory `domestication-batch-topup-deferred`).
- Re-confirming the corrected design with a full-length random-planting triplet (baseline/planted/
  natural), then enqueue `lin_*2_pop80`. Expectation now: planted > baseline > natural.
- **RESULT: the binary-flag design is a NULL — and the investigation found why, then found the right
  design.** Full-150k random-planting arms: baseline/planted/natural all ~0.03, indistinguishable.
  A flag tracer (`runner/diag-lineage.mjs`) verified the flag plumbing is correct but showed planting
  never becomes flag-dominated (~7%, padding dominates); the sown sub-population is pinned at ~6–9%,
  swamped by wild dispersal. KEY: instrumenting the *anchor* (bottom, domesticates 0.49) showed the
  planted lineage is ALSO only ~9% there — so **domestication is a whole-population trait sweep, not a
  lineage takeover**, and a planting-act flag (lost on dispersal) can't track it.
- **RESOLUTION — inherited gens-since-planted counter (`gsp`).** New per-seed field `gsp`: 0 when sown
  (`cell.addSeed` planted=true), +1 every generation (`Seed` constructor), inherited through dispersal.
  Selection `plantStrategy:'mingsp'` plants the lowest-counter (recently-planted) lineage; `'gsp'` (max)
  the deep-wild lineage. Because the counter rides the genetic lineage, it becomes trait-correlated for
  free (non-shattering stays→harvested→replanted→counter low; shattering disperses→counter climbs).
  Full-150k three-way (`diag-lineage.mjs {wt3,anchor,gsp} full`):
  | mode | domeFrac | lowGspFrac | disp(lowGsp) | disp(highGsp) |
  |---|---|---|---|---|
  | wt3 (random)   | 0.03 | 0.45 | 0.87 | 0.88 |
  | anchor (bottom)| 0.49 | 0.54 | 0.22 | 0.89 |
  | gsp (mingsp)   | 0.52 | 0.54 | 0.18 | 0.89 |
  Every regime builds a recently-planted lineage (~half the pop); only *selective* planting (bottom or
  counter) makes it trait-enriched. Counter-selection domesticates as well as the anchor, via an
  explicit lineage signal — the cleanest demonstration of the hypothesis.
- ENQUEUED 2026-06-27: `lin_mingsp_pop80` (plantStrategy mingsp) + `lin_maxgsp_pop80` (plantStrategy
  'gsp', negative control), 5 reps each, pop-80 anchor; compared vs bottom anchor (p20) and random
  baseline (p03). Code: `seed.js` (gsp inherit), `cell.js` (gsp reset on sow) — both inert unless
  plantStrategy is mingsp/gsp, so the running batch is unaffected. Binary-flag arms retired.

## [2026-06-27] Standardized ALL experiments on the pop-80 / energy-15 anchor — addresses: R2.14 — DONE (re-run enqueued)
- Change: the submitted paper ran the 21 core experiments at pop 100 / energy 30; the revision
  moves every experiment and sweep onto one anchor — **pop 80** (sweep sweet-spot) and **energy 15**
  — so the whole study shares a single background and only the variable under test changes.
  `runner/gen-settings.mjs`: the 20 paper experiments p02–p21 now generate at `humanAddRate: 80`
  (p01 no-humans stays pop 0). Audited (2026-06-27): all sweeps + paper experiments now hold the
  full anchor except their intended variable; the harvest experiments additionally neutralize
  planting (plant=random) and the plant experiments neutralize harvest (harvest=random), which is
  the intended one-mechanism-at-a-time isolation, not a confound.
- Consequence: the 20 pop-100 paper runs already in `domestication-final-2026` (100 docs) are
  SUPERSEDED. Left in place for now; purge criterion = "setting key not in current settings.json".
  Recorded in auto-memory `dead-pop100-paper-runs`.
- Re-run: 20 pop-80 paper redos enqueued 2026-06-27 (ids suffixed `_p80` to avoid colliding with the
  retired pop-100 rep ids), alongside the 2 lineage arms — 110 seed runs total.
- Serves R2.14 directly (population is now both an explicit sweep axis AND the standardized anchor at
  the identified optimum).

## [2026-06-29] Energy×pop figure: per-(pop,energy) baseline correction — addresses: R2.14 (figure honesty) — IN PROGRESS (baselines running)
- Context: the energy×pop dashboard heatmap was the one sweep fig left rendered RAW, because proper
  WT1-artifact correction needs a no-planting baseline *at each energy* and only the energy-15
  baselines existed (the `pp_pop{pop}_pl0` cells). Symptom: the pop-10 row read ~1.0 (pure
  small-population gene-minimization artifact: no-planting dome 0.986 vs all-planting 0.991 → ~0
  planting-induced), which misreads as full domestication.
- Change 1 — data: enqueued **630** no-planting baseline runs (`enbase_pop{10..140 by 10}_mt{05,10,
  20,25,30,40,50,60,70}_r{01..05}`, `numPlanters=0`) so each energy column has its own per-population
  baseline across the FULL every-10 pop range. Skips energy 15 (already covered by `pp_pop{pop}_pl0`).
  New: `runner/gen-energy-baselines.mjs`; record in `runner/energy-baselines.json`.
- Change 2 — code: `runner/mongo-figs.mjs` — `render()` now takes `opts.pops` (row-set override) and
  `opts.baseFn(pop,v)` (per-cell baseline); cells with data but no baseline yet render as PENDING
  (gray "…") rather than mixing corrected and raw values. The energy fig spans the full every-10 pop
  range 10–140 and is corrected per-(pop,energy) via a new `baseEnergy(pop,mt)` lookup; no rows are
  dropped — the low-pop rows collapse toward ~0 after correction, honestly showing them as WT1
  artifact. The pp/saved/selective figs are unchanged (still energy-15 baseline).
- Notes: chosen over a blanket energy-15 correction, which would zero the pop-10 row but inject a
  spurious low-energy gradient at pop 20–40 (true no-planting dome is energy-dependent there). The
  figure self-completes as the 630 baselines + the still-pending high-pop energy-sweep cells drain.
  FINDINGS.md reconciled to the locked pop-80/energy-15 anchor in the same pass.

## [2026-06-29] Lineage arms added to the paper-experiment figure class — addresses: R2.6 (lineage hypothesis test) — DONE
- Change: the gene-distribution figure generator (`runner/paper-figs.mjs`) filtered only `pNN_*`
  ids, so the lineage arms (`lin_mingsp_pop80`, `lin_maxgsp_pop80`) produced no figures. Extended the
  filter to `^p\d\d_|^lin_` — the lineage arms are paper experiments (added during the revision), so
  they now render in the same gene-distribution class (per-gene histogram-over-time panels). 23
  paper-exp figures total now (21 + 2 lineage).
- Also: `runner/coordinator.mjs` `runType()` now classifies `lin_*` as `paper exp` and `enbase_*` as
  `baseline` (was falling through to `other`). Cosmetic dashboard grouping; **takes effect on the next
  coordinator restart** (the running instance keeps the old grouping; figure generation is unaffected,
  the figserver respawns `paper-figs.mjs` each cycle).
- Evidence: `lin_mingsp_pop80` n=5 dome 0.519 (recently-planted lineage domesticates), `lin_maxgsp_pop80`
  n=4 dome 0.141 (deep-wild negative control). The dispersal panel shows the non-shattering sweep.

## [2026-07-05] Bug #5 (self-discovered) — hunger silently NaN; metabolic drives asymmetric — addresses: R2.15 (inherited-engine dynamics); impacts R1.4 / R2.13 / R2.14 — DONE (full re-run required)
- Comment: not reviewer-flagged; found while characterizing the human planting-basket mechanism.
- Bug: `params.seedsDiffMetabolism` defaulted to `true`, routing the hunger eat-loop through
  `seed.energy` — but `seed.energy` was never assigned (commented out in `seed.js`, leftover from
  the sibling AgriGin engine). So `this.hunger -= undefined` = **NaN** on the first seed eaten, and
  NaN then propagated permanently. Both the homecoming test (`hunger > metabolicThreshold`) and the
  rest-for-food test (`hunger > -metabolicThreshold`) compare against NaN → always false. Net:
  hunger was inert for the entire history of the model; every prior run effectively used only TWO
  metabolic drives (thirst, tiredness), not three.
- Asymmetry (also fixed): even with NaN removed, hunger reset to `-metabolicThreshold` (a food
  "buffer") while thirst/tired reset to 0, and thirst/hunger decrements were unclamped — so hunger
  still never reached the trigger and could run away to large negatives. Confirmed a bug by the
  author, not an intentional buffer.
- Fix: `util.js` `seedsDiffMetabolism true -> false` (eat-loop now `hunger -= 1`); `human.js`
  hunger rest-floor `-metabolicThreshold -> 0`; clamp thirst & hunger decrements at 0 (symmetric
  with the existing `tired` clamp).
- Location: `util.js:73`; `human.js` (rest condition + drink/eat clamps).
- Commit: `5f5ea36`.
- Evidence (headless, anchor pop80/energy15, 70k, on-disk-verified): homecoming share
  thirst/hunger/tired = 37/0/63 (broken) → 33/33/33 (fixed); mean hunger at homecoming NaN → 12.7;
  dome ~0.35 → ~0.30.
- **Impact: all prior results in `domestication-final-2026` (~7,540 runs, ~3.4 GB) were generated
  with the broken two-drive model and are INVALID; the full batch must be regenerated with this
  fix.** Bears on R1.4 (run variability) and the R2.13/R2.14 sensitivity work, and is a concrete
  instance of the R2.15 inherited-engine concern.

## [2026-07-05] Performance / dead-code guard — predation RNG skipped when off — addresses: R2.15 (inert inherited scaffolding) — DONE
- Change: `seed.update()` ran `Math.random() < params.predationChance` for every seed every tick,
  but `predationChance` is 0 in every Domestication run (natural predation is an AgriGin feature,
  disabled here). The draw was pure waste (~750M calls/run at ~5k seeds × 150k ticks). Short-circuit
  on `params.predationChance > 0`.
- Location: `seed.js:62`.
- Commit: `22d166a`.
- Notes: Model outcome is identical for `predationChance == 0`; it only removes a wasted RNG draw.
  It does shift the RNG stream (one fewer draw/seed/tick), which is acceptable because all results
  are being regenerated anyway (see Bug #5). Part of the R2.15 effort to prune inert inherited code.

## [2026-07-05] Reverted the dormant seed-bank — addresses: R1.BUG1 (by removal) + performance — DONE
- Change: a fallen or sown seed now establishes immediately if its cell has room
  (`seeds.length < cellCapacity`), otherwise it dies on the spot. Removed the dormant queue and
  its machinery: `dormantSeeds`, `germinate()`, `decayDormantSeeds()`, the per-tick `cell.update()`,
  and the O(dimension²) per-tick cell loop in `automata.update`. Dead `level`/`priority` fields and
  the now-unused `offset` argument removed.
- Location: `cell.js` (`addSeed` rewritten; germinate/decay/update/dormantSeeds deleted);
  `automata.js` (cell loop removed; `plantSeeds` double-add fixed).
- Commit: `735bc03`.
- **R1.BUG1 impact — resolved by removal.** The reviewer's "MAJOR" bug was that `germinate()` never
  removed the chosen seed from the dormant queue (`cell.js` splice). That queue no longer exists, so
  the bug cannot occur. This **supersedes** the earlier splice fix (`66cba35`): respond to R1.BUG1 as
  "we removed the over-engineered dormant seed-bank in favour of immediate establishment-or-death,"
  which is simpler and eliminates the defect at its root rather than patching it.
- Rationale: the dormant bank with a 50%/tick decay was behaviourally "root if there is space, else
  die" carried out over many extra steps and a full per-cell pass, for negligible effect on outcomes.
- Evidence (headless, anchor pop80/energy15, 70k, n=1): **+49% faster** (262 → 390 ticks/s); dome
  0.220 → 0.249 with all gene means shifting within single-run noise. To be reconfirmed by the
  anchor recalibration + full re-run now that the model has changed.

## [2026-07-06] Batch pipeline tracked; retarget to the recalibrated anchor — addresses: R1.13 / R2.14 — DONE
- Change: most of the distributed-batch tooling under `runner/` had never been committed. Tracked
  it (coordinator helpers, mongo/pull/stats/sufficiency/adaptive, aggregation, figure renderers,
  `gen-*` scripts, salvage/requeue, recalibration drivers and investigation probes) so the re-run
  infrastructure is versioned and citable in the response to R1.13.
- Retargeted to the recalibrated anchor (population 80, metabolic threshold 20, epoch 100k,
  populations 10–100): `gen-settings.mjs` and the regenerated `settings.json` move
  `metabolicThreshold` 15→20 and `epoch` 150k→100k, with SAVED {.05–30} and ENERGY {10,20,30,40,50};
  `mongo-figs.mjs` figure ranges follow.
- New re-run queue builders: `gen-energy-queue.mjs` (energy×population plus per-cell baselines)
  and `gen-rerun.mjs` (planters/saved/selective/paper/lineage, deduped against the energy grid,
  dovetailed rep-major).
- `.gitignore`: exclude generated data, figures, and state.
- Commit: `a36befe` (55 files, ~7,500 lines).
- Notes: the epoch change from 150k to 100k time steps is a reported-methods change and appears
  in the paper's Model section.

## [2026-07-06] Flux instrumentation, uncapped basket, dashboard viewers — addresses: R2.3 / R2.14 (measurement) — DONE
- Change (behaviour-neutral recording; dome and gene results unchanged): `datamanager.js` and
  `human.js` now record per-planting-event and per-harvest-event distributions (four genes plus
  lineage age) plus population lineage age (all/wild/domesticated) and planting and harvest counts,
  per period. This makes the selection differential directly measurable: planted dispersal sits
  below population, which sits below harvested. That differential is the quantity the sweeps are
  really varying, and it is what became the paper's reproductive-isolation measure.
- Change (behavioural): `util.js` `plantBasketSize` 50 → 400, non-binding above the ~65 per-trip
  ceiling at metabolic threshold 50, so the basket cap is no longer a hidden driver of
  domestication at high energy. **Not results-neutral at high energy** — flagged for the letter.
- Batch matrix: population range extended to 10–120.
- Dashboard (`figserver`): a batch viewer (every DB collection with document counts) and a run
  viewer (aggregate all reps of one setting; `setting-fig.mjs` renders the seed trajectory and a
  5×5 distribution grid). The live sim UI gained the same planted/harvested/lineage panels.
- Commit: `f20a61a`.

## [2026-07-06] Adaptive settings-driven coordinator; divergence and collapse figures — addresses: R1.4 / R2.3 — DONE
- Coordinator (`coordinator2.mjs`): replaces the FIFO run-queue with a settings-list driver. It
  round-robins over unfinished bins, mints replicate ids on demand so the dovetail is intrinsic,
  and on each `/complete` runs `stats.mjs` to mark a bin finished once it clears `MIN_N` (3) and
  its CI meets target, with no a-priori maximum. Rebuilds all bin state from Mongo on startup, so
  it is fully resumable. Same endpoints and port, so workers reconnect unchanged.
- Analysis figures:
  - `div-figs.mjs` — per-sweep lineage-divergence heatmaps mirroring the domestication sweeps,
    using total variation distance between the planted and harvested lineage-age distributions.
    TV is saturation-proof (it compares bucket mass, not the 9999/bucket-19 clamp) and needs no
    baseline, sitting near zero wherever planting is not selective.
  - `collapse-fig.mjs` — the collapse scatter: every sweep cell as a point (x = TV, y = corrected
    domestication, coloured by sweep) with the binned-mean curve and pooled correlation.
  - `figserver.mjs` — serves domestication/divergence pairs side by side with the collapse scatter
    on top.
- Commit: `ea80428`.
- Notes: this is the infrastructure behind the paper's `fig:collapse` and the whole Reproductive
  Isolation results thread.

## [2026-07-06 → 07-07] Coordinator convergence policy — addresses: R1.4 — DONE
- `55802a7` — fewest-reps-first dispatch instead of round-robin by list position, so coverage stays
  balanced by replicate count at every moment and an imbalanced start self-heals. Per-worker run
  timers so `/status` reports real on-run seconds and completions carry duration and ticks/sec.
- `c3d1891` — stall detection: after a floor of 10 reps, a bin that has not converged is declared
  non-converged if its `nNeeded` is receding (variance still being revealed) or stuck high. The
  coordinator writes `convergence.json` and `mongo-figs.mjs` overlays a per-cell status dot on each
  sweep figure, so batch progress is visible per cell.
- `69d295c`, `a52709e` — status-dot legibility: dropped the "working" dot (blue read too close to
  converged green) and made the non-converged dot pure red. No dot now means still working.
- `a220ec5` — converge budget raised to 100 and the receding check dropped. A bin past the n=10
  floor keeps running while `nNeeded ≤ 100` and is flagged only once the estimate exceeds it, so
  boundary cells needing 30–97 reps run to convergence and only genuine non-convergers stop.
- `e4f0e62` — **sufficiency criterion corrected.** The old `evaluate()` used a hurdle model,
  splitting each setting's replicates at an arbitrary threshold of 0.1 into "ignited" and not, and
  demanding tight CIs on both the ignition probability and the conditional mean. That 0.1 is a
  stats-layer cutoff on the population domesticated *fraction*, unrelated to the model's per-seed
  0.6 dispersal threshold, and it manufactured false boundary cells wherever a cluster straddled
  it — `pp_pop80_pl30`, a tight ~0.094 cell (sd 0.025), read 8 no-ignite / 2 ignite and demanded
  ~477 reps despite its overall mean CI already being ±0.018. Sufficiency is now judged on the
  overall mean domesticated fraction CI, which is exactly the value the heatmaps plot.
- `e7fcac8` — coordinator no longer dies on a Mongo socket reconnect. socket.io re-fires `connect`
  on reconnect, so a transient blip re-ran the bootstrap and `server.listen()` threw
  `ERR_SERVER_ALREADY_LISTEN`. Bootstrap is now guarded to run once.
- Notes: taken together these are the machinery behind the R1.4 claim that 91% of 927 conditions
  converge at 10 replicates with a median CI half-width of 0.003, and behind Supplement S4.

## [2026-07-07] Reviewer-facing README and MIT LICENSE — addresses: R1.11 / R1.13 / R2.15 / R2.16 — DONE
- README: scientific summary; a code-structure overview that **separates the domestication model
  from the reused generic CA and game engine** (R2.15); how to run it three ways (browser,
  headless, distributed batch); a per-experiment configuration pointer to `settings.json` and
  `gen-settings.mjs` (R1.13); and a gene-name decoder mapping the historical code identifiers to
  the paper's gene names (Seed Dispersal = code `weight`, Abscission = code `dispersal`), so a
  reader cross-checking code against paper is not tripped by the crossed labels.
- LICENSE: MIT (R2.16).
- Commit: `c48ca6f`.

## [2026-07-30] Web interface overhaul — addresses: R2.17 — DONE
- Dashboard: population-graph legend (Total / Wild / Domesticated with live counts) and axis
  titles; heat-map colour-ramp and axis key panel; corrected gene labels matching the paper
  (Root Depth, Fecundity, Seed Dispersal, Abscission); a Full Population column label; a live
  time-step readout; a 10px-gutter grid. The FPS and status readout moved out of the bottom graph
  row into the top-right, and the stale clear rectangle that was overwriting the bottom row is
  gone. Planted and Harvested reordered so lineage age lines up.
- Controls: all five swept parameters exposed (population, planters, seeds saved, planting
  selectivity, metabolic energy). Planters is a slider whose maximum tracks the population.
  Reset now re-runs the current controls instead of auto-cycling; the auto-cycle and DB-log loop
  is removed.
- Presets: an experiment dropdown carrying the paper's 24 named experiments plus the two
  lineage-age runs.
- Commit: `b86910f`.
- Notes on inertness: the only model-source change is one additive entry in the `HARVEST` lookup
  table in `human.js` (`gsp` / `mingsp`), which no pre-existing strategy reads. The `automata.js`
  changes are browser-loop and drawing code; the headless runner drives its own loop. `util.js`
  lost 919 lines, almost all of it the retired auto-cycle run list, and gained the named presets.

## [2026-07-30] Figure pipeline aligned with the paper — addresses: (reproducibility) — DONE
- `9a18426` `regen-paper.mjs`: repoint the collapse step at the two-lens figure the paper actually
  uses (`collapse_twolens.pdf` via `_gspcollapse.mjs` and `collapse_lens.py`), add the mega
  sensitivity panel (`mega.pdf`) and the split figure (experiment 19 → `split.pdf`), and drop the
  four `sweep_*.pdf` panels and `pexp_grid.pdf` the paper no longer uses. Streamlined the DB pull
  by running mega before collapse so `_gspcollapse` reuses `megafig-cache.json` for the ~700 shared
  lineage-age cells and pulls only the ~12 discrete anchors.
- `7cfe08f` **Supplement figure pipeline** — data generators (`gen-csvs.mjs` per-experiment
  distribution CSVs for the S3 grids, `pexp-grid.mjs` discrete 24-experiment grid now carrying the
  signed mean lineage-age gap as a third metric, `s4-anchor.mjs` convergence data,
  `_probe-hp.mjs` confirming the DB holds the harvested/planted/lineage fields) and renderers
  (`supp_grid.py`, `collapse_panels.py`, `heat_pexp.py`, `heat_mega.py`, `s4_fig.py`).
- `6691e4d` **Revision-era sweep and robustness updates** to tracked runner scripts: sweep grids
  extended to the full published range (population and planters to 160, seeds saved to 1.0, energy
  to 100); an incremental divergence cache keyed on replicate count plus a 4-socket pull pool so
  the per-cell lineage-age loop parallelizes; no-planting cells treated as exactly zero divergence
  rather than missing; per-sweep binned-mean curves and per-sweep r, with the discrete anchor
  experiments overlaid and `collapse-data.json` exported. Coordinator now only exits on a Mongo
  connect error before bootstrap. Watchdogs switched from hard time limits to stall detection with
  progress flush, so slow remote pulls are not aborted mid-loop.
- `c3b9b54` **Main-paper figure pipeline** — the remaining reusable scripts behind the main-text
  figures: `gen-megafig-data.mjs`, `gen-sweep-data.mjs`, `compose-figs.mjs`, `fig-specs.mjs`, and
  the renderers `collapse_plot.py`, `collapse_lens.py`, `heat_sweeps.py`, `graph.py`, and the
  `hist_*` family (First, control, wild, sickles, prelims, bottom, dome).
- Notes: generated artifacts (PDFs, CSVs, caches) and the `_`-prefixed scratch probes stay
  untracked by design.

## [2026-08-06] REGRESSION FOUND AND FIXED — the web-interface commit silently broke the headless runner — addresses: (self-found; bears on all runs after 2026-07-30) — FIXED
- Found while verifying, for the response letter, whether the `alife-2026-final` tag sits on the code
  that produced the paper's data and whether the post-tag commits are cosmetic.
- **Bug:** `headless.mjs` injects its per-run configuration by monkey-patching
  `Automata.prototype.nextRun`, which the constructor reached via `reset()`. The R2.17 web-interface
  commit (`b86910f`, 2026-07-30 15:00) changed the constructor to call `applyPreset(0)` instead, which
  does not go through `nextRun`. From that commit onward `__CONFIG` was **never applied**: every
  headless run silently executed preset 0 ("01. no humans") at the `util.js` defaults (epoch 150000,
  `humanAddRate` 200) regardless of the config it was handed.
- **Why it is dangerous:** it does not error. The run completes and stores a well-formed payload, so a
  corrupted run is indistinguishable from a real one except by reading the `params` recorded inside it.
- Evidence (same config `{epoch:100, humanAddRate:77, plantStrategy:"bottom", metabolicThreshold:42}`,
  tag in a clean worktree vs HEAD):
  | | tag `c48ca6f` | HEAD (before fix) |
  |---|---|---|
  | epoch | 100 | 150000 |
  | humanAddRate | 77 | 200 (default) |
  | plantStrategy | bottom | none (default) |
  | metabolicThreshold | 42 | 30 (default) |
- **Fix:** override `applyPreset` as well as `nextRun` in the headless appendix. NB `applyPreset` calls
  `buildAutomata()` itself (for `nextRun` that was `reset()`'s job), so the override must too — the
  first attempt dropped it and crashed with an unbuilt board.
- **Guard added:** after `new Automata()`, headless now compares every primitive key of `__CONFIG`
  against `params` and throws if any did not land. Verified both ways — passes on the fixed version,
  and fires with `config key "epoch" not applied (want 100, got 150000)` when the hook is removed.
  A silent wrong-run is now a loud failure.
- **Open — data exposure:** any run executed after 2026-07-30 15:00 would be corrupt. Corrupted runs are
  detectable in Mongo: their stored `params` read `runName: "01. no humans"`, `epoch: 150000`,
  `humanAddRate: 200` no matter what their settingKey says. This must be checked before the data is
  called final.

### Verification that the tag is on the experiment build
Done in the same pass, file by file across everything `headless.mjs` loads
(`util.js, gene.js, gameengine.js, datamanager.js, seed.js, human.js, cell.js, automata.js`):
- `gene.js`, `gameengine.js`, `seed.js`, `cell.js` — unchanged since the tag.
- `util.js` — the `params` defaults block is **byte-identical**; the 919-line diff is entirely the
  browser preset list (`runs`), which headless never consults.
- `human.js` — one additive `HARVEST` table entry (`gsp`/`mingsp`); no pre-existing strategy reads it.
- `datamanager.js` — `Histogram`/`Graph` labels and screen coordinates plus `draw`/`drawKey`; both
  classes are stubbed and `draw` is overridden in headless, so it cannot affect a run.
- `automata.js` — the regression above.
- `runner/settings.json` — all 340 tag entries byte-identical, one added (`p22_sickle_noplant`).
- `runner/headless.mjs` — gained the gated `params.artificial` branch; the `else` branch is the original
  loop verbatim, so paper runs take the unchanged path.
- Off the headless load path entirely: `graph.js`, `histogram.js`, `main.js`, `index.html`.

Conclusion: the tag is on a build that runs the experiments correctly, and every post-tag change except
the `automata.js` regression is cosmetic or additive.

## [2026-08-06] Publish the analysis probes backing paper claims — addresses: R1.13 / R2.15 — DONE
- Four diagnostics that had been left untracked are now published, because each is the evidence for a
  statement in the manuscript:
  - `_orderprobe.mjs` — does per-tick update order shift the domesticated fraction? Backs the
    update-order robustness sentence in the Model section.
  - `_holdwindow.mjs` — how many ticks a plant holds its seeds (maturity → drop). Backs the
    2 / 8–14 / 26+ time-step harvesting-window figures in the Cereal Plants and Seeds section.
  - `_gspdir.mjs` — is the planted lineage actually younger than the harvested population? Backs the
    sign of the mean lineage-age gap (TV distance is symmetric and hides direction).
  - `_capprobe.mjs` — how hard `granaryCap` binds, and on which store.
- Left untracked: `_domediv.mjs` (DB-analysis scratch) and `_raster.mjs` (SVG rasterizer needing
  `@resvg/resvg-js`, which is not in `package.json`).

---

## Open items

### Blocking

1. **Push to GitHub.** The remote-tracking ref for `Domestication/master` is at `6758c48`,
   **20 commits behind** local `master` (`c3b9b54`). Everything reviewer-facing is local-only:
   the R1.BUG1 fix, the codebase-clarity pass, README, LICENSE, the R2.17 web interface, and the
   whole figure pipeline. The paper's Model section gives
   `https://github.com/algorithm0r/Domestication` as the availability URL, so a reviewer following
   it today sees the pre-revision code with the flagged bug still in `cell.js`.
   *Confirm against GitHub directly — the local remote-tracking ref may simply be stale.*

2. **Version tag (R1.12).** The only tag here is `alife-2026-final`, pointing at `c48ca6f`
   (2026-07-07). The entries above and the paper's `reviews/reviewer-comment-index.md` both cite a
   tag named `paper-ARTL-2026-0060`, which does not exist — the 2026-06-24 entry at the top of
   this file is wrong on that point and should be corrected. `c48ca6f` also predates `b86910f`,
   which is where `util.js` gained the named experiment presets, so the tag does not point at the
   source that carries the paper's run configurations. Decide whether to move the tag or add a
   second one at the head of the model source, then correct both changelogs and the reviewer index.

### Closed since the last pending list

- **R1.11 / R2.16** README and LICENSE — done, `c48ca6f`.
- **R1.13** per-experiment configuration — done, `settings.json` plus the README pointer.
- **R2.15** file and call structure documented, inherited engine code flagged and pruned — done
  across `c48ca6f` and the cleanup pass (`0124bdb`, `5244a05`, `26eb3e9`, `4aebce4`, `91d95da`,
  `18a9861`, `22d166a`).
- **R2.17** web interface legends and axis titles — done, `b86910f`.

### For the response letter

- **R1.BUG1** — answer as removal, not patch: the dormant seed-bank is gone (`735bc03`), so the
  defect cannot occur. The earlier splice fix (`66cba35`) is superseded.
- **R1.BUG2** — intended; humans multitask per excursion and harvesting still happens once per
  tick. Documented via the tick pseudocode and ODD §7.9–7.12.
- **R1.BUG3** — not a defect; "immortal" is a misreading, seeds die via `seedDeathChance`.
- **Bug #5 (self-discovered, `5f5ea36`)** — hunger was silently NaN for the entire history of the
  model, so every prior run used two metabolic drives rather than three. All paper results were
  regenerated after this fix. This is not reviewer-flagged and should be disclosed on our own
  initiative, together with the dormant-bank removal (`735bc03`), the anchor standardization
  (`a36befe`), the epoch change from 150k to 100k time steps, and the basket-cap raise
  (`f20a61a`) — all of which move reported magnitudes.
