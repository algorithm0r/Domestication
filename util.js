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
    updatesPerDraw: 25,

    // environment
    size: 16,
    dimension: 50,
    dry: -11,
    riverWidth: 4,
    range: 16,
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

    // humans
    humanAddRate: 200,
    seedsDiffMetabolism: true,
    metabolicThreshold: 30,
    metabolicUnit: 5,
    skinSize: 30,
    scoopSize: 5,
    basketSize: 400,
    plantBasketSize: 50,
    seedStrategy: 0,
    runName: "01. wild type 1 - no humans",
    plantStrategy: "none",
    harvestStrategy: "none",
    plantSelectionChance: 1.0,
    plantSelectionStrength: 0.2,
    seedDropRate: 0.02,
    maxSeedDrop: 3,
    individualSeedSeparation: true,
    sharedPlantingSeeds: true,

    // data gathering
    wildDomesticThreshold: 0.6,
    reportingPeriod: 250,
    epoch: 150000,

    // database
    db: "domesticationDB",
    collection: "exp2024v4"
};

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
    // params.seedsDiffMetabolism = document.getElementById("seeds_metabolism").checked;
    // params.metabolicThreshold = parseInt(document.getElementById("metabolic_threshold").value);
    // params.metabolicUnit = parseInt(document.getElementById("metabolic_unit").value);
    // params.skinSize = parseInt(document.getElementById("skin_size").value);
    // params.scoopSize = parseInt(document.getElementById("scoop_size").value);
    // params.basketSize = parseInt(document.getElementById("basket_size").value);
    params.seedStrategy = document.getElementById("seed_selection").value;
    params.plantStrategy = document.getElementById("plant_selection").value;

    console.log(params);
};

const runs = [
    {   
        runName: "01. wild type 1 - no humans",
        harvestStrategy: "none",
        plantStrategy: "none",
        humanAddRate: 0,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.0,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "02. wild type 2 - humans harvest randomly",
        harvestStrategy: "random",
        plantStrategy: "none",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.0,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },  
    {   
        runName: "03. wild type 3 - humans harvest and plant randomly",
        harvestStrategy: "random",
        plantStrategy: "random",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "04. exp 1 - harvesting shattering",
        harvestStrategy: "dispersal",
        plantStrategy: "none",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.0,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "05. exp 1 - harvesting non-shattering (sickle hypothesis)",
        harvestStrategy: "mindispersal",
        plantStrategy: "none",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.0,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },        
    {   
        runName: "06. exp 1 - harvesting shattering with random planting",
        harvestStrategy: "dispersal",
        plantStrategy: "random",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "07. exp 1 - harvesting non-shattering with random planting",
        harvestStrategy: "mindispersal",
        plantStrategy: "random",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "08. exp 2 - planting the first harvested seeds",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "09. exp 2 - planting the last harvested seeds",
        harvestStrategy: "random",
        plantStrategy: "top",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "10. exp 2 - harvesting shattering planting first harvested seeds",
        harvestStrategy: "dispersal",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "11. exp 2 - harvesting shattering planting harvested seeds",
        harvestStrategy: "dispersal",
        plantStrategy: "top",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "12. exp 2 - harvesting non-shattering planting first harvested seeds",
        harvestStrategy: "mindispersal",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "13. exp 2 - harvesting non-shattering planting harvested seeds",
        harvestStrategy: "mindispersal",
        plantStrategy: "top",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "14. exp 3 - planting light seeds",
        harvestStrategy: "random",
        plantStrategy: "weight",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "15. exp 3 - planting heavy seeds",
        harvestStrategy: "random",
        plantStrategy: "minweight",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "16. exp 3 - planting deep rooted seeds",
        harvestStrategy: "random",
        plantStrategy: "deepRoots",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "17. exp 3 - planting shallow rooted seeds",
        harvestStrategy: "random",
        plantStrategy: "mindeepRoots",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "18. exp 3 - planting shattering seeds",
        harvestStrategy: "random",
        plantStrategy: "dispersal",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "19. exp 3 - planting non-shattering seeds",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "20. exp 4 - double humans first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 200,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "21. exp 4 - less selective first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.5,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "22. exp 4 - fewer selective humans first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 0.5,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "23. exp 4 - half humans first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 50,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "24. exp 4 - more selective first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.1,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "25. exp 4 - much fewer selective humans first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 0.25,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "26. exp 4 - double humans non-shattering",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 200,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "27. exp 4 - less selective non-shattering",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.5,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "28. exp 4 - fewer selective humans non-shattering",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 100,
        plantSelectionChance: 0.5,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "29. exp 4 - half humans non-shattering",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 50,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "30. exp 4 - more selective non-shattering",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.1,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "31. exp 4 - much fewer selective humans non-shattering",
        harvestStrategy: "random",
        plantStrategy: "mindispersal",
        humanAddRate: 100,
        plantSelectionChance: 0.25,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },

];
