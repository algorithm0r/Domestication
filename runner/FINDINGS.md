# Domestication simulations — consolidated findings

*Working report. Source material for the paper revision (ARTL-2026-0060). **Anchor for the whole rewrite: pop 80 / energy 15** (bottom-of-basket planting, all humans plant, saved 0.20, selective 1.0). The current figures are the live dashboard set, rendered from the `domestication-final-2026` Mongo aggregate (`node figserver.mjs` → http://localhost:8089/); the embedded `.png` below are legacy energy-20 renders kept for prose history — see the Figure-provenance note in §3.*

**Scope of runs:** the final `domestication-final-2026` matrix is 533 distinct settings (×5+ replicates each) at the pop-80 / energy-15 anchor, across a two-machine cluster (algorithm0r-Main-2022, 15 workers + algorithm0r-Media-2016/Mint, 6 workers), coordinated through a shared HTTP work-queue. Metric throughout: **dome fraction** = mean fraction of seeds that are non-shattering (dispersal < 0.6) over the final third of each run.

---

## 1. Phase diagram: planting effort vs predation

The core result. Rows = harvesters (predation pressure), columns = planters (planting effort). Left = raw dome fraction; right = baseline-corrected (each cell minus that population's pure-harvester value, removing the WT1 low-population artifact).

![Phase diagram: predation × planting effort](./domestication_panels.png)

- **A diagonal domestication band:** to domesticate, planting effort must scale with predation — more harvesters eating shattering seeds require more planters to overcome them.
- **A hard predation ceiling around 140–150 harvesters:** above it, no in-range planting domesticates; predation wins outright. (This justifies capping all subsequent crosses at pop 140.)
- **The low-population corner is an artifact, not a result.** Raw, the smallest populations look ~totally domesticated (pop10 ≈ 0.98) with *zero* planting — pure WT1 gene-minimization drift. The corrected panel removes it; the genuine planting-induced signal is strongest at **moderate population (60–100)**.

*Regenerate:* `node heatmap.mjs` (raw colour clamped at 0.45 so the artifact corner doesn't wash out the band).

---

## 2. Run-to-run variation (reviewer R1.4)

Replicate runs at representative cells. The bulk is essentially deterministic; the boundary is genuinely volatile **and bimodal**.

| cell | regime | n | mean dome | SD | CV |
|---|---|---|---|---|---|
| `pop60_pl40` | deep domesticated | 16 | 0.435 | **0.0028** | **0.7%** |
| `pop200_pl0` | deep wild | 16 | 0.001 | 0.0002 | 13.6% |
| `pop100_pl80` | **boundary** | 20 | 0.272 | **0.053** | **19.5%** |
| `pop120_pl110` | **boundary** | 16 | 0.202 | **0.064** | **31.8%** |

- **Bulk:** a single run is the truth (CV 0.7% deep in the domesticated regime; ~0 in the wild). This is *why* the single-seed phase-diagram cells form a smooth gradient.
- **Boundary:** CV 20–32%, individual runs ranging 0.03–0.30 at identical settings. The population is stable (pop SD < 1%) — it's the *outcome* that's bimodal. The domestication feedback loop reads as a **probabilistic tipping point**: it either ignites or fizzles, and the smooth boundary in the phase diagram is an *average over that coin-flip*.

**Implication:** single-run cells are reliable in the bulk but not at the boundary; boundary cells need replication, and exact boundary *location* carries real uncertainty.

*Regenerate:* `node agg-volatility.mjs`.

---

## 3. Parameter crosses (coordinate ascent around the anchor)

Anchor = bottom-of-basket planting, all humans plant, **energy 15**, saved 0.20, selective 1.0. We swept each knob × population (capped at 140) to test whether its optimum shifts the anchor. **All cross maps below are baseline-corrected** (energy-15 pure-harvester baselines subtracted — see §4).

> **Figure provenance (read before reusing any image here).** The current, correct figures are the **live dashboard** set — `fig_pp.svg` / `fig_saved.svg` / `fig_selective.svg` / `fig_energy.svg`, rendered by `mongo-figs.mjs` from the live `domestication-final-2026` Mongo aggregate at the **energy-15** anchor (dashboard: `node figserver.mjs` → :8089). The `.png`/`.svg` files embedded below (`domestication_panels`, `cross_*`, `energy_curve`) are the **legacy energy-20** renders from the local-`results/` pipeline (`heatmap.mjs`, `heatmap-cross.mjs`) and are retained only for the prose history — **do not pull them into the paper.** The energy cross is shown *raw* in both pipelines (see §3c / §4 for why).

### 3a. saved% (fraction of harvest set aside to plant)

![saved% × population, corrected](./cross_saved.png)

- **Interior optimum with a floor.** Low saved% → you plant only the earliest (most arid-biased) seeds → strong selection. But too low and `diff = floor(seeds×saved%)` hits 0 — those humans plant nothing. So a real minimum-viable saved% exists, and **it rises with population** (each human harvests fewer seeds when there are more harvesters): peak shifts 0.15 → 0.20 as pop goes 80 → 140. Bottom-left collapses to near-zero (pop140: 0.05/0.10/0.15 saved → ~0).
- **Anchor: 0.20 holds** — the only column that stays domesticated across the whole population range (highest column mean). Confirms the submitted default.

*Regenerate:* `node heatmap-cross.mjs saved` · table: `node agg-cross-saved.mjs`.

### 3b. selective% (share of planting that uses the selective rule)

![selective% × population, corrected](./cross_selective.png)

- **Monotonic:** domestication rises smoothly with selective participation, **peaking at 1.0** across every population. `chance = 0` (fully random planting) collapses toward WT3 (pop80: 0.025).
- **Anchor: 1.0 holds** (it's the ceiling — confirms the submitted default). The effect steepens with population: at pop140 you need near-100% participation to domesticate at all.

*Regenerate:* `node heatmap-cross.mjs selective` · table: `node agg-cross-selective.mjs`.

### 3c. energy (human metabolic budget, `metabolicThreshold`)

![energy × population, raw](./cross_energy.png)

The 2D grid (every-10) shows the energy optimum is a **real peak, not a plateau**, robust across populations 60–140: mt15–20 beat mt30 by ~0.10 everywhere (pop80: mt15 0.491, mt20 0.484, mt30 0.384). **This map is baseline-corrected per-(pop, energy)** — each cell minus the no-planting (`numPlanters=0`) dome at the *same* population *and* energy, because the no-planting baseline is itself energy-dependent (a single energy-15 baseline applied across all columns would zero the pop-10 artifact but inject a spurious low-energy gradient at pop 20–40). The per-energy baselines come from the `enbase_*` runs (full every-10 pop range; see §4). The low-population rows are kept, not dropped: after correction they collapse toward ~0 — e.g. raw pop10 reads ~0.99 at every energy but its no-planting baseline is ~0.986, so corrected ≈ 0, honestly showing it as ~100% artifact / ~0 planting-induced rather than hiding it.

Finer resolution + replication at pop80 refines the peak:

![Energy optimum at pop 80](./energy_curve.png)

| metabolicThreshold | dome (mean ± SD, n=10) |
|---|---|
| **15** | **0.4917 ± 0.0023** ← peak |
| 20 | 0.4841 ± 0.0018 |
| 25 | 0.4285 ± 0.0017 |

- **The true optimum is ~15, not 20.** The every-10 sweep found 20 only because it never tested 15. SDs are tiny (~0.002), so mt15 > mt20 is real (3–4σ).
- **Below mt15 the single runs are unreliable** (mt10 = 0.142 looks like a bistability "miss"; the single mt5 = 0.580 can't be trusted) — consistent with §2. Pinning the exact low-energy optimum would need replication at mt 5–10.
- **Resolved — anchor locked at energy 15.** mt15 is the measured peak (0.4917 vs mt20 0.4841, a 3–4σ gap), so every rewrite experiment now runs at energy 15. The submitted phase diagram was energy 30; at the locked anchor it shifts up by ~0.10.

**What `metabolicThreshold` means kinetically — the foraging excursion, and part of "what is a day".** Energy isn't an abstract knob: it sets the mean length of a foraging trip. Each forage tick (`Human.spendEnergy`) adds one unit to *one* of three metabolic channels — thirst / hunger / tired — chosen uniformly (1/3 each), and the human is forced back to shelter the instant any channel exceeds the threshold $T$. Starting fresh from shelter, the trip ends when the first of three counters reaches $T{+}1$ — a 3-bin occupancy race, so the expected excursion is

$$E[\text{ticks}] = \sum_{n=0}^{3T} P(\text{all three channels} \le T \text{ after } n \text{ ticks}),$$

verified by Monte Carlo. It is **not** $3(T{+}1)$: racing three channels trips earlier than the per-channel mean. Values: **≈38 ticks at the energy-15 anchor** (25 at energy 10, 52 at energy 20, 79 at energy 30); near the anchor it grows ~2.5 ticks per unit of energy. This is the concrete handle on **"what is a day"** — a forage-and-return cycle is ~38 ticks of wandering plus the shelter rest, so a 150k-tick run is thousands of such cycles — and it grounds the **energy sweep**: raising `metabolicThreshold` lengthens excursions roughly linearly, letting humans range further from shelter before resting. (Excursions can also end early when both baskets fill, `human.js:356`, so this is an upper bound on trip length.) *Compute:* the 3-bin DP / MC in this session's notes.

*Regenerate:* `node heatmap-cross.mjs energy` · `node plot-energy.mjs`.

---

## 4. The WT1 artifact and baseline correction

Why correction matters: the pure-harvester (no-planting) dome **at the energy-15 anchor** is large at low population and negligible at high population.

| pop | 10 | 20 | 40 | 60 | 80 | 100 | 120 | 140 |
|---|---|---|---|---|---|---|---|---|
| energy-15 baseline dome (n=5) | 0.986 | 0.799 | **0.358** | 0.121 | **0.032** | 0.014 | 0.008 | 0.004 |

At pop40 the baseline is 0.358 — so the raw saved%/selective% pop40 rows were **mostly artifact**. Correction subtracts a per-population constant, so it does **not** change which parameter value wins (column rankings are preserved) — but it correctly relocates the honest planting-induced signal to mid-population (pop 60–100, where the baseline is already small: 0.121 → 0.014). *(Your call to correct these was right — the raw maps were misleading at low pop.)*

**Live baselines:** the corrected dashboard figs (`mongo-figs.mjs`) subtract these per-population energy-15, `numPlanters=0` cells (the `pp_pop{pop}_pl0` cells in `settings.json`), looked up directly from the Mongo aggregate — no separate baseline job. The legacy `gen-baselines.mjs` (energy-20, `base_e20_pop{pop}`) fed only the retired local-`results/` figures and is superseded. **The energy cross uses a per-(pop, energy) baseline** (not the single energy-15 value), because the no-planting dome varies with energy: the `enbase_pop{pop}_mt{mt}` runs (full every-10 pop range 10–140 × all energies, `numPlanters=0`, via `gen-energy-baselines.mjs`) supply one baseline per cell. Until a cell's baseline lands it renders "pending …" rather than mixing corrected and raw values.

---

## 5. Coordinate-ascent summary

| knob | swept | result | anchor |
|---|---|---|---|
| population | full phase diagram | sweet spot ~80 (strong signal, low artifact) | 80 (for slices) |
| saved% | × pop | interior optimum, rises with pop | **0.20** (confirmed) |
| selective% | × pop | monotonic, peaks at ceiling | **1.0** (confirmed) |
| energy | × pop + replicated 1D | real peak at ~15 | **15** (locked) |

Both submitted defaults (saved 0.20, selective 1.0) were **confirmed, not shifted**. Energy is the one refinement: optimum **locked at 15**, and energy *matters* (15 ≫ 30 by ~0.10) — so the main phase diagram (submitted at energy 30) shifts up at the locked anchor. The whole rewrite batch (`domestication-final-2026`) now runs at pop-80 / energy-15 anchor settings.

---

## 6. Open items

1. ~~Final pop×planters rerun at locked anchors~~ — **done / in progress:** the whole matrix reruns at the locked pop-80 / energy-15 anchor inside the live `domestication-final-2026` batch.
2. ~~Energy anchor decision~~ — **resolved: locked at 15** (measured peak, §3c/§5).
3. **Low-energy replication** (mt 5–10 ×10) to resolve whether the optimum is below 15 — still open; single low-energy runs are unreliable (§3c).
4. ~~Energy-fig correction~~ — **resolved (in progress):** full per-(pop, energy) no-planting baselines enqueued (`enbase_*`, 630 runs, every-10 pops 10–140 × all energies) so the entire energy×pop map is per-cell corrected; no rows dropped. Figure self-completes as the baselines + still-pending high-pop sweep cells drain.
5. **1 errored cell** (`energy_pop40_mt60`, headless failed) — artifact-heavy off-optimum corner, immaterial; requeue for completeness.
6. **Low-energy anomaly at pop 30 / energy 5 — worth a closer look (2026-06-30).** The energy×pop map has a sharp, *reproducible* spike in the low-energy corner: at pop 30 / mt 5 the all-planting sweep is 0.978 and the no-planting baseline 0.656 (both n=5, tight — SD 0.005 / 0.017, `regime=interior`, `p(ignite)=1`), giving a corrected planting-induced 0.322 — far above its neighbors (mt10 corrected 0.063). So it's genuine model behavior, not bistability/noise/an outage artifact. It sits in the corner we discount (pop ≤ 40 is WT1-artifact-heavy; energy 5 ≈ ~12-tick foraging excursions, a degenerate regime), so it shouldn't lead the story — but the *mechanism* is unexplained: why do very short foraging excursions push BOTH baseline and planted domestication up? To check: instrument harvest counts / seed-flow per trip at mt5 vs mt30 (across pops) before asserting any cause. Don't hand-wave it.
