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
    seedsDiffMetabolism: true,
    metabolicThreshold: 30,
    metabolicUnit: 5,
    skinSize: 30,
    scoopSize: 5,
    basketSize: 400,
    plantBasketSize: 50,
    granaryCap: 2000,        // max seeds stored in the shared shelter (food / planting stores)
    runName: "01. no humans",
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
    ip: 'https://73.19.38.112:8888',
    db: "domesticationDB",
    collection: "test003"
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
    params.harvestStrategy = document.getElementById("seed_selection").value;
    params.plantStrategy = document.getElementById("plant_selection").value;

    console.log(params);
};

const runs = [
    // {   
    //     runName: "01. no humans",
    //     harvestStrategy: "none",
    //     plantStrategy: "none",
    //     humanAddRate: 0,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.0,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "02. harvest random plant none",
    //     harvestStrategy: "random",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.0,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },  
    // {   
    //     runName: "03. harvest random plant random",
    //     harvestStrategy: "random",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "04. harvest max roots plant random",
    //     harvestStrategy: "deepRoots",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "05. harvest max fecundity plant random",
    //     harvestStrategy: "fecundity",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "06. harvest max weight plant random",
    //     harvestStrategy: "weight",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "07. harvest max dispersal plant random",
    //     harvestStrategy: "dispersal",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "08. harvest min roots plant random",
    //     harvestStrategy: "mindeepRoots",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "09. harvest min fecundity plant random",
    //     harvestStrategy: "minfecundity",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "10. harvest min weight plant random",
    //     harvestStrategy: "minweight",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "11. harvest min dispersal plant random",
    //     harvestStrategy: "mindispersal",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "12. harvest random plant max roots",
    //     harvestStrategy: "random",
    //     plantStrategy: "deepRoots",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "13. harvest random plant max fecundity",
    //     harvestStrategy: "random",
    //     plantStrategy: "fecundity",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "14. harvest random plant max weight",
    //     harvestStrategy: "random",
    //     plantStrategy: "weight",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "15. harvest random plant max dispersal",
    //     harvestStrategy: "random",
    //     plantStrategy: "dispersal",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "16. harvest random plant min roots",
    //     harvestStrategy: "random",
    //     plantStrategy: "mindeepRoots",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "17. harvest random plant min fecundity",
    //     harvestStrategy: "random",
    //     plantStrategy: "minfecundity",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "18. harvest random plant min weight",
    //     harvestStrategy: "random",
    //     plantStrategy: "minweight",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "19. harvest random plant min dispersal",
    //     harvestStrategy: "random",
    //     plantStrategy: "mindispersal",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    {   
        runName: "20. harvest random planting first harvested",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
        predationChance: 0,
    },
    // {   
    //     runName: "21. harvest random planting last harvested",
    //     harvestStrategy: "random",
    //     plantStrategy: "top",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "22. harvest random planting first harvested 50 humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 50,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "23. harvest random planting first harvested 150 humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 150,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "24. harvest random planting first harvested 200 humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 200,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "25. harvest random planting first harvested 250 humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 250,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "26. harvest random planting first harvested 90% selective humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.9,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "27. harvest random planting first harvested 80% selective humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.8,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "28. harvest random planting first harvested 70% selective humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.7,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "29. harvest random planting first harvested 60% selective humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.6,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "30. harvest random planting first harvested 50% selective humans",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.5,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "31. harvest random planting first harvested select 10% to plant",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.1,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "32. harvest random planting first harvested select 30% to plant",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.3,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "33. harvest random planting first harvested select 40% to plant",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.4,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "34. harvest random planting first harvested select 50% to plant",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.5,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "35. harvest random planting first harvested individual planting seeds",
    //     harvestStrategy: "random",
    //     plantStrategy: "bottom",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: false,
    // },
    // {   
    //     runName: "36. harvest random planting first harvested collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "37. harvest random plant max roots collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "deepRoots",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "38. harvest random plant max fecundity collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "fecundity",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "39. harvest random plant max weight collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "weight",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "40. harvest random plant max dispersal collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "dispersal",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "41. harvest random plant min roots collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "mindeepRoots",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "42. harvest random plant min fecundity collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "minfecundity",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "43. harvest random plant min weight collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "minweight",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "44. harvest random plant min dispersal collective granary",
    //     harvestStrategy: "random",
    //     plantStrategy: "mindispersal",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: false,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "45. harvest max roots plant none",
    //     harvestStrategy: "deepRoots",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "46. harvest max fecundity plant none",
    //     harvestStrategy: "fecundity",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "47. harvest max weight plant none",
    //     harvestStrategy: "weight",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "48. harvest max dispersal plant none",
    //     harvestStrategy: "dispersal",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "49. harvest min roots plant none",
    //     harvestStrategy: "mindeepRoots",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "50. harvest min fecundity plant none",
    //     harvestStrategy: "minfecundity",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "51. harvest min weight plant none",
    //     harvestStrategy: "minweight",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "52. harvest min dispersal plant none",
    //     harvestStrategy: "mindispersal",
    //     plantStrategy: "none",
    //     humanAddRate: 100,
    //     plantSelectionChance: 0.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    // {   
    //     runName: "53. harvest min dispersal plant random",
    //     harvestStrategy: "mindispersal",
    //     plantStrategy: "random",
    //     humanAddRate: 100,
    //     plantSelectionChance: 1.0,
    //     plantSelectionStrength: 0.2,
    //     individualSeedSeparation: true,
    //     sharedPlantingSeeds: true,
    // },
    {   
        runName: "54. harvest random planting first harvested ",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 50,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "55. harvest random planting first harvested 100 humans predation",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 100,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "56. harvest random planting first harvested 150 humans predation",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 150,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "57. harvest random planting first harvested 200 humans predation",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 200,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
    {   
        runName: "58. harvest random planting first harvested 250 humans predation",
        harvestStrategy: "random",
        plantStrategy: "bottom",
        humanAddRate: 250,
        plantSelectionChance: 1.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
];
