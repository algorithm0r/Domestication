# Domestication — an agent-based model of cereal-grain domestication

Simulation code for the paper **"Domestication through unintentional selective planting in artificial cereal grains"** (C. Marriott and J. Chebib), submitted to *Artificial Life* (manuscript **ARTL-2026-0060**).

## Summary

This is a spatial, agent-based / cellular-automata model in which simulated **humans** forage a gridded landscape of **cereal-grain plants (seeds)**. Each grain carries a small genome of four continuous-valued heritable traits — **root depth**, **fecundity** (number of seeds produced), **seed dispersal** (how far offspring scatter), and **abscission** (how long a ripe seed is retained before shattering off the plant) — that mutate and are inherited across plant generations. (The source-code field names for two of these are historical and do **not** match the paper's names — see the [gene-name decoder](#a-note-on-gene-names-code--paper) below.) Human agents metabolize energy, harvest grain from plants, carry it back to a shared shelter/granary, eat some, and re-sow the rest. Because harvesting and re-planting are *not* uniformly random with respect to those traits (grain that is easier to gather, that is retained on the plant rather than shattering, or that is preferentially replanted is over-represented in the next sown generation), an artificial **domestication syndrome** emerges over evolutionary time *without any deliberate breeding intent* — the central result of the paper. The model tracks the wild-vs-domesticated composition of the grain population and the drift of each gene's distribution over time.

The core research question is which combination of harvesting strategy, planting strategy, planting selectivity, human population, and metabolic pressure is sufficient to drive domestication, and how strongly.

## Requirements

- A modern web browser (for the interactive simulation).
- **Node.js 18+** for the headless batch runner (`runner/` uses the built-in `fetch` and `node:` core modules).
- `npm install` inside `runner/` (one dependency: `socket.io-client`, used to talk to the data backend).

## Repository layout: model vs. generic engine

The browser build reuses a **general-purpose JavaScript game / cellular-automata engine** (originally adapted from Seth Ladd's "Bad Aliens" HTML5 game framework) as rendering and main-loop scaffolding. That scaffolding is *not* part of the domestication model and does not affect its dynamics — in the headless runner the drawing code is stubbed out entirely and only the model's `update()` logic runs (see "Ruling out unintended dynamics" below). The table distinguishes the two.

### Domestication model (the science)

| File | Role |
|------|------|
| `util.js` | **Parameter block** (`params` object with all model defaults), global helpers, and `loadParameters()` (reads the browser UI controls). This is where the model's default configuration lives. |
| `automata.js` | The **world / cellular automaton**: builds the NxN grid, seeds the initial population, adds humans, and drives one simulation tick (`update()`), including the run/reset lifecycle. |
| `cell.js` | A single **grid cell** (terrain/water, its resident seeds and humans, neighbour links). |
| `seed.js` | The **grain agent**: its four `RealGene` traits (`deepRoots`, `fecundity`, `weight`, `dispersal` — see the gene-name decoder below), growth, reproduction, seed scattering, and the lineage tags used by the domestication metric. |
| `human.js` | The **human agent**: metabolism, movement, harvesting (predation), carrying, and selective re-planting behaviour. |
| `datamanager.js` | **Metrics and logging**: population counts, wild/domesticated split (classified on the abscission gene, code `dispersal < 0.6`), and the per-gene histograms over time; assembles the data payload stored to the database. |
| `gene.js` | `RealGene` — a single continuous [0,1] trait with mutation. Small model helper. |

### A note on gene names (code ↔ paper)

The four gene identifiers in the source are **historical** — they were chosen before the domestication framing and carry no scientific meaning, so two of them do not match the paper's functional names. The mechanism is what defines each gene; the label is incidental. Results in the paper are correct — only the identifiers are crossed. Use this decoder when cross-checking code against the manuscript:

| Paper name | Code field (`seed.js`) | Data field | What it actually controls |
|------------|------------------------|-----------|---------------------------|
| **Root Depth** | `deepRoots` | `rootData` | water sensitivity of growth rate (`growthUnit`, `seed.js:41`) |
| **Fecundity** | `fecundity` | `seedData` | number of seeds produced at maturity (`seed.js:53`) |
| **Seed Dispersal** | `weight` | `weightData` | P(offspring lands in a neighbour cell) (`seed.js:98`) |
| **Abscission** | `dispersal` | `dispersalData` | drop-timing / shatter — retention on the plant (`dropThreshold`, `seed.js:45`) |

So the two crossed pairs are: paper **Seed Dispersal** = code `weight`, and paper **Abscission** = code `dispersal`. Root Depth and Fecundity match. Wild vs. domesticated (non-shattering) is classified on the **abscission** gene, i.e. code `dispersal < 0.6`. The experiment IDs in `runner/settings.json` follow the **code** names, so e.g. `p07_harv_maxDispersal` is *harvest-select for maximum abscission* (shattering) and `p18_plant_minWeight` is *plant-select for minimum seed dispersal*.

### Generic engine / UI scaffolding (reused, not model-specific)

| File | Role |
|------|------|
| `gameengine.js` | Generic game loop (entity list, `update()`/`draw()`, timer, `requestAnimationFrame`). Reused framework — **not written for this study.** In headless runs `draw()` is stubbed; only `update()` matters. |
| `main.js` | Browser bootstrap: constructs the engine, opens the (optional) database socket, wires the Reset button. |
| `index.html` | The interactive page: canvas + the parameter controls, and the script include order. |
| `assetmanager.js` | Generic image/asset preloader (unused by the model beyond boot). |
| `histogram.js`, `graph.js`, `graphs.js`, `graphs.html`, `style.css` | On-canvas / on-page visualization only. No effect on model state. |

### Headless runner (`runner/`) — batch execution and figures

| File | Role |
|------|------|
| `headless.mjs` | Runs **one** configuration to completion with no browser/DOM (concatenates the model files, stubs the canvas, applies a params override, returns `{stats, data}`). |
| `worker.mjs` | Claims a run from the coordinator, executes it via `headless.mjs`, reports stats + heartbeats; loops until the queue drains. |
| `launch.mjs` | Spawns N worker processes on one machine (defaults to ~half the logical cores). |
| `coordinator2.mjs` | **Adaptive, settings-driven coordinator.** Holds the list of settings, dovetails replicates round-robin, decides per-setting when enough replicates have run (CI target), and stores each run to MongoDB. Resumable (rebuilds from the DB on startup). |
| `coordinator.mjs` | Older fixed-FIFO queue coordinator (superseded by `coordinator2.mjs`). |
| `mongo.mjs` | Thin client for the socket.io-fronted MongoDB data backend; also defines the `dome` domestication metric and the `settingKey` used to group replicates. |
| `stats.mjs` | Per-setting statistics (establishment probability + degree, confidence intervals, replicate sufficiency). |
| `gen-settings.mjs` | Generates `settings.json` — **the authoritative experiment matrix** (see below). |
| `pull.mjs` | Pulls all runs from Mongo and writes `data/<collection>/aggregate.json` (per-setting means). |
| `mongo-figs.mjs` | Renders the baseline-corrected sweep **heatmaps** (`fig_*.svg`) from the aggregate. |
| `paper-figs.mjs` | Renders the per-experiment **gene-distribution histograms** (`paper_*.svg`) directly from the raw Mongo runs. |
| `figserver.mjs` | Local dashboard (port 8089): live batch progress + a viewer that renders any collection's figures. |
| `adaptive.mjs` | Alternative enqueue-and-top-up replication driver (round of N0 reps, then tops up under-precision settings). |
| Other `gen-*.mjs`, `_*.mjs`, `*.json`, `*.png/svg` | One-off calibration probes, generated queues, and intermediate outputs from the exploratory phase. Not required to reproduce the paper; the `.gitignore` deliberately keeps only `settings.json` and the npm manifests. |

## How to run

### 1. Interactive browser simulation

Open `index.html` in a browser (serving the folder over a local static web server is recommended so the socket.io include and relative paths resolve cleanly; opening the file directly also works, with the database connection simply disabled).

- Use the on-page controls to set the human add rate, planting/harvesting strategies, and selection parameters, then press **Reset** to (re)start a run with the current settings.
- All other parameters come from the `params` defaults in `util.js`.
- The database connection is optional: if no backend is reachable the sim still runs and renders locally (the "Database" indicator simply shows disconnected).

### 2. Headless single run

From the `runner/` directory:

```bash
cd runner
npm install

# inline JSON override:
node headless.mjs '{"humanAddRate":80,"harvestStrategy":"random","plantStrategy":"random","epoch":100000}' out.json

# or read the override from a file (note the leading @):
node headless.mjs @config.json out.json
```

`headless.mjs <config> <out.json>`: `<config>` is either an inline JSON object of parameter overrides, or `@filename.json` to read that object from a file. Anything not overridden falls back to the `params` defaults in `util.js`. The result file contains `{ stats, data }`, where `data` matches the format the browser build stores to the database.

### 3. Distributed batch (the paper's data)

The full experiment set is run as a coordinator + many workers, writing each replicate to MongoDB.

```bash
cd runner
npm install

# (optional) regenerate the experiment matrix
node gen-settings.mjs                      # writes settings.json

# start the adaptive coordinator (defaults: PORT=8088, collection=domestication-final-2026)
node coordinator2.mjs settings.json domestication-final-2026

# on each machine, launch workers (default coordinator URL http://localhost:8088,
# default worker count ~= half the logical cores)
node launch.mjs http://<coordinator-host>:8088
```

Useful environment variables: `PORT` (coordinator port, default 8088), `MIN_N` (minimum replicates per setting, default 3), `MAX_N` (cap a stalled setting), and `MONGO_URL` / `MONGO_DB` (data backend, see below). Workers accept `PERSIST=1` to idle on an empty queue instead of exiting.

> **Data backend note.** `runner/mongo.mjs` talks to a **remote socket.io-fronted MongoDB** (default `https://research.climbinggiants.com:8888`, database `domesticationDB`). This is the authors' server and will not be reachable by others. To reproduce the batch you would point `MONGO_URL`/`MONGO_DB` at your own compatible socket.io backend (one that answers `insert`/`find`/`count` events as `mongo.mjs` expects). A single run does **not** need any backend — use `headless.mjs` directly.

## Experiment configuration (exact configs used)

Every experiment is a fully-specified parameter set. There are two layers:

1. **Model defaults** — the `params` object at the top of **`util.js`**. Every parameter the model reads is declared there with its default value and an inline comment.
2. **The experiment matrix** — **`runner/settings.json`**, an array of `{ id, config }` entries where each `config` is the *complete* set of swept parameters for one experiment (e.g. `humanAddRate`, `numPlanters`, `metabolicThreshold`, `plantSelectionStrength`, `plantSelectionChance`, `harvestStrategy`, `plantStrategy`, `epoch`, ...). Replicates of one `config` share a `settingKey` (see `runner/mongo.mjs`). `settings.json` is generated reproducibly by **`runner/gen-settings.mjs`**, which is commented with exactly which sweeps and anchor values define the paper's experiments (the `p01_…`–`p21_…` paper experiments plus the population / saved% / selective% / energy sweeps and the `lin_…` lineage arms).

To reproduce a *specific* experiment, take its `config` from `settings.json` (or the labelled entry in `gen-settings.mjs`) and pass it straight to `headless.mjs`.

## Reproducing the paper

1. The exact source build used for the published runs is git-tagged **`alife-2026-final`**; check it out before reproducing (`git checkout alife-2026-final`). The simulation model itself was frozen earlier in the history; commits after the model freeze are analysis/figure tooling only and do not change simulation output.
2. Generate/confirm the experiment matrix: `node gen-settings.mjs` → `settings.json`.
3. Run the batch (coordinator + workers, above). Each replicate is stored as one document in the MongoDB collection (`domestication-final-2026`), carrying its full `params`, the raw per-gene histogram time series, and the derived scalar domestication metric (`dome`).
4. Aggregate and render figures:
   ```bash
   node pull.mjs domestication-final-2026        # -> data/<coll>/aggregate.json
   node mongo-figs.mjs domestication-final-2026  # -> sweep heatmaps  fig_*.svg
   node paper-figs.mjs domestication-final-2026  # -> gene-distribution panels  paper_*.svg
   ```
   or simply run `node figserver.mjs` and browse the dashboard at `http://localhost:8089`, which runs the same `pull → mongo-figs → paper-figs` pipeline per collection.

## Ruling out unintended dynamics (reused engine)

Because the rendering/game framework (`gameengine.js` and the visualization files) was built for other purposes and reused here, the headless runner is deliberately arranged so that **only the model's state-update logic can influence results**:

- `runner/headless.mjs` loads exactly the model set `['util.js','gene.js','gameengine.js','datamanager.js','seed.js','human.js','cell.js','automata.js']` — the same class definitions the browser uses.
- It then **stubs out everything visual**: `DataManager.draw`, the canvas, `Graph`/`Histogram`, and the engine's `draw()` are no-ops. The simulation is advanced by calling `board.update()` in a plain loop for exactly `epoch` ticks (no `requestAnimationFrame`, no timer, no frame-rate coupling).
- The browser's parameter-loading path is neutralized and replaced by the explicit `config` override, so a headless run is a pure, deterministic function of `params`.

In short: the generic engine contributes the entity list and the `update()` dispatch; all domestication dynamics live in `automata.js`, `seed.js`, `human.js`, `cell.js`, and `datamanager.js`.

## License

This project is released under the **MIT License** — see the [`LICENSE`](LICENSE) file. You are free to use, modify, and redistribute the code with attribution.

## Citation

If you use this code, please cite:

> C. Marriott and J. Chebib. *Domestication through unintentional selective planting in artificial cereal grains.* Artificial Life (submitted; manuscript ARTL-2026-0060).
