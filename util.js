//GameBoard code below
function randomInt(n) {
    return Math.floor(Math.random() * n);
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

var params = {
    // environment
    size: 16,
    dimension: 50,
    dry: -11,
    riverWidth: 4,
    floodRate: 0.0,
    droughtRate: 0.0,
    seasonLength: 500,
    humansAdded: 10000,


    // seeds
    randomSeeds: false,
    germThreshold: 50,
    fullGrown: 50,
    seedDeathChance: 0,
    growthPenalty: 50,

    // humans
    humanAddRate: 0.05,
    seedsDiffMetabolism: true,
    metabolicThreshold: 50,
    metabolicUnit: 1,
    skinSize: 20,
    scoopSize: 5,
    basketSize: 20,
    plantBasketSize: 50,
    seedStrategy: 0,
    plantStrategy: "none",
    seedDropRate: 0.02,
    maxSeedDrop: 3,

    // data gathering
    reportingPeriod: 100,
    epoch: 20000,

    // database
    db: "domesticationDB",
    collection: "runs"
};

function loadParameters() {
    // params.size = parseInt(document.getElementById("cell_size").value);
    // params.dimension = parseInt(document.getElementById("dimension").value);
    // params.riverWidth = parseInt(document.getElementById("river_width").value);
    // params.dry = 1 - parseInt(document.getElementById("bank_size").value);

    params.randomSeeds = document.getElementById("random_seeds").checked;
    params.germThreshold = parseInt(document.getElementById("germ_threshold").value);
    params.fullGrown = parseInt(document.getElementById("full_growth").value);
    params.seedDeathChance = parseFloat(document.getElementById("seed_death_chance").value);
    params.growthPenalty = parseInt(document.getElementById("growth_penalty").value);

    params.humanAddRate = parseFloat(document.getElementById("human_add_rate").value);
    params.seedsDiffMetabolism = document.getElementById("seeds_metabolism").checked;
    params.metabolicThreshold = parseInt(document.getElementById("metabolic_threshold").value);
    params.metabolicUnit = parseInt(document.getElementById("metabolic_unit").value);
    params.skinSize = parseInt(document.getElementById("skin_size").value);
    params.scoopSize = parseInt(document.getElementById("scoop_size").value);
    params.basketSize = parseInt(document.getElementById("basket_size").value);
    params.seedStrategy = document.getElementById("seed_selection").value;
    params.plantStrategy = document.getElementById("plant_selection").value;

    console.log(params);
};