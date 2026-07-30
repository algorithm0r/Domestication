//GameBoard code below
function randomInt(n) {
    return Math.floor(Math.random() * n);
};

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
};

function rgb(r, g, b) {
    return "rgb(" + r + "," + g + "," + b + ")";
};

function hsl(h, s, l) {
    return "hsl(" + h + "," + s + "%," + l + "%)";
};

function download(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);
    pom.click();
};


function databaseConnected() {
    const dbDiv = document.getElementById("db");
    dbDiv.classList.remove("db-disconnected");
    dbDiv.classList.add("db-connected");
};

function databaseDisconnected() {
    const dbDiv = document.getElementById("db");
    dbDiv.classList.remove("db-connected");
    dbDiv.classList.add("db-disconnected");
};


var params = {
    // sim
    updatesPerDraw: 10,

    // environment
    size: 16,
    dimension: 50,
    dry: -11,
    riverWidth: 4,
    range: 16,
    shelterDensity: 1, // probability each edge cell is a shelter (1 = continuous edges; < 1 limits the number of shelters)
    floodRate: 0.0,
    droughtRate: 0.0,
    seasonLength: 500,
    humansAdded: 25000,
    plantingTime: 50000,

    // seeds
    randomSeeds: true,
    germThreshold: 100,
    fullGrown: 100,
    seedDeathChance: 0.01,
    growthPenalty: 100,
    predationChance: 0,
    pluckRate: 0.75,         // fraction of a plant's seeds recovered when plucked/harvested
    dormantDecayChance: 0.5, // probability a dormant soil-bank seed decays each tick
    cellCapacity: 4,         // max simultaneously-growing seeds per cell
    initialSeedDensity: 0.1, // probability each cell is seeded at world initialization

    // humans
    humanAddRate: 200,
    seedsDiffMetabolism: false,   // FIX: seed.energy was never assigned (commented out in seed.js), so the true-branch of the eat loop did `hunger -= undefined` = NaN, silently disabling hunger as a metabolic drive. false -> `hunger -= 1`.
    metabolicThreshold: 30,
    metabolicUnit: 5,
    skinSize: 30,
    scoopSize: 5,
    basketSize: 400,
    plantBasketSize: 400,    // raised well above the per-trip carry ceiling (~65 at mt50) so the basket cap never binds — removes it as a hidden driver of domestication (was 50)
    granaryCap: 2000,        // max seeds stored in the shared shelter (food / planting stores)
    runName: "01. no humans",
    plantStrategy: "none",
    plantLineage: "off",     // lineage experiment: "planted"/"natural" restricts replanting to grain whose parent plant was / was not human-sown; "off" = no restriction (default; behaviorally inert)
    harvestStrategy: "none",
    plantSelectionChance: 1.0,
    plantSelectionStrength: 0.2,
    numPlanters: 1e9,        // number of humans that plant (capped at population); the rest harvest only (predation)
    seedDropRate: 0.02,
    maxSeedDrop: 3,
    individualSeedSeparation: true,
    sharedPlantingSeeds: true,

    // data gathering
    wildDomesticThreshold: 0.6,
    reportingPeriod: 250,
    epoch: 150000,

    // database
    ip: 'https://73.19.38.112:8888',
    db: "domesticationDB",
    collection: "test003"
};

// read a numeric control, falling back to a default if the element is missing (e.g. stale cached HTML) or blank
function numCtl(id, dflt) {
    const el = document.getElementById(id);
    if (!el) return dflt;
    const v = parseFloat(el.value);
    return isNaN(v) ? dflt : v;
}

function loadParameters() {
    // params.size = parseInt(document.getElementById("cell_size").value);
    // params.dimension = parseInt(document.getElementById("dimension").value);
    // params.riverWidth = parseInt(document.getElementById("river_width").value);
    // params.dry = 1 - parseInt(document.getElementById("bank_size").value);

    // params.randomSeeds = document.getElementById("random_seeds").checked;
    // params.germThreshold = parseInt(document.getElementById("germ_threshold").value);
    // params.fullGrown = parseInt(document.getElementById("full_growth").value);
    // params.seedDeathChance = parseFloat(document.getElementById("seed_death_chance").value);
    // params.growthPenalty = parseInt(document.getElementById("growth_penalty").value);

    params.individualSeedSeparation = document.getElementById("individualSeedSeparation").checked;
    params.sharedPlantingSeeds = document.getElementById("sharedPlantingSeeds").checked;
    params.plantSelectionChance = parseFloat(document.getElementById("plantSelectionChance").value);
    params.plantSelectionStrength = parseFloat(document.getElementById("plantSelectionStrength").value);
    params.humanAddRate = parseFloat(document.getElementById("human_add_rate").value);
    params.numPlanters = numCtl("numPlanters", 1e9);
    params.metabolicThreshold = numCtl("metabolicThreshold", 30);
    // params.seedsDiffMetabolism = document.getElementById("seeds_metabolism").checked;
    // params.metabolicUnit = parseInt(document.getElementById("metabolic_unit").value);
    // params.skinSize = parseInt(document.getElementById("skin_size").value);
    // params.scoopSize = parseInt(document.getElementById("scoop_size").value);
    // params.basketSize = parseInt(document.getElementById("basket_size").value);
    params.harvestStrategy = document.getElementById("seed_selection").value;
    params.plantStrategy = document.getElementById("plant_selection").value;

    console.log(params);
};

// Planters slider: its max is the current population. "Sticky at max" — if it is parked at the max it rides
// up/down with the population; otherwise it holds its value (clamped so it can never exceed the population).
function syncPlanters() {
    const popEl = document.getElementById("human_add_rate");
    const sl = document.getElementById("numPlanters");
    if (!popEl || !sl) return;
    const pop = parseFloat(popEl.value) || 0;
    const atMax = parseFloat(sl.value) >= parseFloat(sl.max);
    sl.max = pop;
    if (atMax || parseFloat(sl.value) > pop) sl.value = pop;
    const valEl = document.getElementById("numPlantersVal");
    if (valEl) valEl.innerHTML = sl.value;
}
function onPlantersInput() {
    const sl = document.getElementById("numPlanters");
    const valEl = document.getElementById("numPlantersVal");
    if (sl && valEl) valEl.innerHTML = sl.value;
}

const DEFAULT_RUN = { plantLineage: "off", predationChance: 0 };

// Curated experiment presets for the interface dropdown: the paper's named experiments (01-24) plus the
// lineage-isolation experiment. Fields not set here fall back to DEFAULT_RUN / params defaults when applied.
const runs = [
  { runName: "01. Wild Type I - no humans",                  harvestStrategy: "none",         plantStrategy: "none",        humanAddRate: 0,   plantSelectionChance: 0.0, plantSelectionStrength: 0.0 },
  { runName: "02. Wild Type II - harvest only",              harvestStrategy: "random",       plantStrategy: "none",        humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.0 },
  { runName: "03. Wild Type III - harvest + random plant",   harvestStrategy: "random",       plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "04. Harvest max Root Depth",                   harvestStrategy: "deepRoots",    plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "05. Harvest max Fecundity",                    harvestStrategy: "fecundity",    plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "06. Harvest max Seed Dispersal",               harvestStrategy: "weight",       plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "07. Harvest max Abscission",                   harvestStrategy: "dispersal",    plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "08. Harvest min Root Depth",                   harvestStrategy: "mindeepRoots", plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "09. Harvest min Fecundity",                    harvestStrategy: "minfecundity", plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "10. Harvest min Seed Dispersal",               harvestStrategy: "minweight",    plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "11. Harvest min Abscission",                   harvestStrategy: "mindispersal", plantStrategy: "random",      humanAddRate: 100, plantSelectionChance: 0.0, plantSelectionStrength: 0.2 },
  { runName: "12. Plant max Root Depth",                     harvestStrategy: "random",       plantStrategy: "deepRoots",    humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "13. Plant max Fecundity",                      harvestStrategy: "random",       plantStrategy: "fecundity",    humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "14. Plant max Seed Dispersal",                 harvestStrategy: "random",       plantStrategy: "weight",       humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "15. Plant max Abscission",                     harvestStrategy: "random",       plantStrategy: "dispersal",    humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "16. Plant min Root Depth",                     harvestStrategy: "random",       plantStrategy: "mindeepRoots", humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "17. Plant min Fecundity",                      harvestStrategy: "random",       plantStrategy: "minfecundity", humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "18. Plant min Seed Dispersal",                 harvestStrategy: "random",       plantStrategy: "minweight",    humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "19. Plant min Abscission",                     harvestStrategy: "random",       plantStrategy: "mindispersal", humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "20. Plant first harvested (bottom of basket)", harvestStrategy: "random",       plantStrategy: "bottom",       humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "21. Plant last harvested (top of basket)",     harvestStrategy: "random",       plantStrategy: "top",          humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "22. Plant first harvested - 50 humans",        harvestStrategy: "random",       plantStrategy: "bottom",       humanAddRate: 50,  plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "23. Plant first harvested - 150 humans",       harvestStrategy: "random",       plantStrategy: "bottom",       humanAddRate: 150, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "24. Plant first harvested - 200 humans",       harvestStrategy: "random",       plantStrategy: "bottom",       humanAddRate: 200, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "25. Lineage age - plant youngest lineage (isolates)", harvestStrategy: "random", plantStrategy: "mingsp", humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
  { runName: "26. Lineage age - plant oldest lineage (control)",     harvestStrategy: "random", plantStrategy: "gsp",    humanAddRate: 100, plantSelectionChance: 1.0, plantSelectionStrength: 0.2 },
];

function populatePresets() {
    const sel = document.getElementById("preset");
    if (!sel) return;
    sel.innerHTML = "";
    for (let i = 0; i < runs.length; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.text = runs[i].runName;
        sel.appendChild(opt);
    }
}
