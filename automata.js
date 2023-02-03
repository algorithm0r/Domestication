function Automata(game) {
    this.game = game;
    this.game.board = this;
    this.x = 0;
    this.y = 0;

    loadParameters();
    this.buildAutomata();
};

Automata.prototype.createBoard = function () {
    for (var i = 0; i < params.dimension; i++) {
        this.board.push([]);
        for (var j = 0; j < params.dimension; j++) {
            this.board[i].push(new Cell(this.game, i, j, this));
        }
    }

    for (var i = 0; i < params.dimension; i++) {
        for (var j = 0; j < params.dimension; j++) {
            this.board[i][j].init(this.board);
        }
    }
    this.generateRiver();
    this.plantSeeds();
    this.addShelters();
};

Automata.prototype.partitionSeeds = function () {
    var seeds = this.shelter.seeds;
    var plant = [];

    // var selections = ["weight","deepRoots","fecundity","fruitEnergy","dispersal"];
    // var selectionProperty = selections[randomInt(selections.length)];
    var selectionProperty = params.plantStrategy;

    if (seeds.length > 0 && this.shelter.plantSeeds.length < seeds.length / 4) {
        if (selectionProperty == "none") {
            // do nothing
        } else if (selectionProperty == "random") {
            this.shelter.plantSeeds.push(...seeds.splice(0, seeds.length / 4));
        } else if (selectionProperty.substring(0, 3) == "min") {
            selectionProperty = selectionProperty.slice(3);
            var avg = seeds.reduce((p, c) => p + (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]), 0) / seeds.length;
            var obj = seeds.reduce((p, c) => (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]) < avg
                ? { sum: p.sum + (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]), num: p.num + 1 }
                : p, { sum: 0, num: 0 });
            var avg2 = obj.sum / obj.num;

            [this.shelter.seeds, plant] = seeds.reduce(([k, p], c) => (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]) > avg2 ? [[...k, c], p] : [k, [...p, c]], [[], []]);
            this.shelter.plantSeeds.push(...plant);
        } else {
            var avg = seeds.reduce((p, c) => p + (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]), 0) / seeds.length;
            var obj = seeds.reduce((p, c) => (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]) > avg
                ? { sum: p.sum + (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]), num: p.num + 1 }
                : p, { sum: 0, num: 0 });
            var avg2 = obj.sum / obj.num;

            [this.shelter.seeds, plant] = seeds.reduce(([k, p], c) => (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]) < avg2 ? [[...k, c], p] : [k, [...p, c]], [[], []]);
            this.shelter.plantSeeds.push(...plant);
        }
    }
    if (this.shelter.seeds.length > 2000) {
        this.shelter.seeds.splice(0, this.shelter.seeds.length - 2000);
    }
};

Automata.prototype.generateRiver = function () {
    //var start = Math.floor(randomInt(params.dimension / 10) + params.dimension * 0.45);
    var start = Math.floor(params.dimension / 2);
    for (var i = 0; i < params.dimension; i++) {
        this.board[start][i].water = params.riverWidth;
        for (var j = 1; j < params.dimension - start; j++) {
            this.board[start + j][i].water = Math.max(params.riverWidth - j, params.dry);
        }
        for (var j = 1; j < start - 1; j++) {
            this.board[start - j][i].water = Math.max(params.riverWidth - j + 1, params.dry);
        }

        //if (randomInt(5) === 0)
        //    start += randomInt(2) === 0 ? 1 : -1;
    }
};

Automata.prototype.plantSeeds = function () {
    for (var i = 0; i < params.dimension; i++) {
        for (var j = 0; j < params.dimension; j++) {
            if (Math.random() < 0.1) {
                var seed = new Seed({ cell: this.board[i][j] })
                this.board[i][j].addSeed(seed);
                this.seeds.push(seed);
            }
        }
    }
};

Automata.prototype.addHumans = function (numOfHumans) {
    for (var i = 0; i < params.dimension; i++) {
        for (var j = 0; j < params.dimension; j++) {
            for (var k = 0; k < numOfHumans; k++) {
                if (Math.random() < params.humanAddRate && this.board[i][j].shelter) {
                    var human = new Human({ game: this.game, x: i, y: j, cell: this.board[i][j] });
                    this.board[i][j].addHuman(human);
                    this.humans.push(human);
                }
            }
        }
    }
};

Automata.prototype.addShelters = function () {
    var prob = 1;
    for (var i = 0; i < params.dimension; i++) {
        if (Math.random() < prob) {
            var j = randomInt(1);
            this.board[j][i].shelter = this.shelter;
        }
        if (Math.random() < prob) {
            var j = params.dimension - randomInt(1) - 1;
            this.board[j][i].shelter = this.shelter;
        }
    }
};

Automata.prototype.updateData = function () {
    var weightData = [];
    var rootsData = [];
    var seedData = [];
    var energyData = [];
    var dispersalData = [];
    var seedPop = 0;
    var humanPop = 0;

    for (var i = 0; i < 20; i++) {
        weightData.push(0);
        rootsData.push(0);
        seedData.push(0);
        energyData.push(0);
        dispersalData.push(0);
    }
    for (var i = 0; i < params.dimension; i++) {
        for (var j = 0; j < params.dimension; j++) {
            var cell = this.board[i][j];
            seedPop += cell.seeds.length;
            humanPop += cell.humans.length;
        }
    }

    for (var k = 0; k < this.seeds.length; k++) {
        var weightIndex = Math.floor(this.seeds[k].weight.value * 20) < 20 ? Math.floor(this.seeds[k].weight.value * 20) : 19;
        weightData[weightIndex]++;
        var rootsIndex = Math.floor(this.seeds[k].deepRoots.value * 20) < 20 ? Math.floor(this.seeds[k].deepRoots.value * 20) : 19;
        rootsData[rootsIndex]++;
        var seedIndex = Math.floor(this.seeds[k].fecundity.value * 20) < 20 ? Math.floor(this.seeds[k].fecundity.value * 20) : 19;
        seedData[seedIndex]++;
        var energyIndex = Math.floor(this.seeds[k].fruitEnergy.value * 20) < 20 ? Math.floor(this.seeds[k].fruitEnergy.value * 20) : 19;
        energyData[energyIndex]++;
        var dispersalIndex = Math.floor(this.seeds[k].dispersal.value * 20) < 20 ? Math.floor(this.seeds[k].dispersal.value * 20) : 19;
        dispersalData[dispersalIndex]++;
    }

    this.weightData.push(weightData);
    this.weightHist.data = this.weightData;
    this.rootData.push(rootsData);
    this.rootHist.data = this.rootData;
    this.seedData.push(seedData);
    this.seedHist.data = this.seedData;
    this.energyData.push(energyData);
    this.energyHist.data = this.energyData;
    this.dispersalData.push(dispersalData);
    this.dispersalHist.data = this.dispersalData;

    this.seedPop.push(seedPop);
    this.humanPop.push(humanPop);
}

Automata.prototype.reset = function () {
    this.nextRun();
    this.updateParams();
    this.buildAutomata();
};

Automata.prototype.buildAutomata = function () {
    
    this.game.entities = [];
    this.game.addEntity(this);

    this.day = 0;
    //this.season = 0; // 0 = winter, 1 = spring, 2 = summer, 3 = autumn

    this.shelter = { water: 0, seeds: [], plantSeeds: [] };

    // agents
    this.seeds = [];
    this.humans = [];

    // data gathering
    this.weightData = [];
    this.rootData = [];
    this.seedData = [];
    this.energyData = [];
    this.dispersalData = [];

    this.seedPop = [];
    this.humanPop = [];

    // graphs
    this.popGraph = new Graph(this.game, 810, 0, this, "Population");
    this.game.addEntity(this.popGraph);
    this.weightHist = new Histogram(this.game, 810, 200, "Seed Weight")
    this.game.addEntity(this.weightHist);
    this.rootHist = new Histogram(this.game, 810, 300, "Root Depth");
    this.game.addEntity(this.rootHist);
    this.seedHist = new Histogram(this.game, 810, 400, "Number of Seeds");
    this.game.addEntity(this.seedHist);
    this.energyHist = new Histogram(this.game, 810, 500, "Nutritional Value");
    this.game.addEntity(this.energyHist);
    this.dispersalHist = new Histogram(this.game, 810, 600, "Dispersal");
    this.game.addEntity(this.dispersalHist);

    this.board = [];

    this.createBoard();
};

Automata.prototype.logData = function () {
    var data = {
        db: params.db,
        collection: params.collection,
        data: {
            run: "X1",
            params: params,
            seedPop: this.seedPop,
            humanPop: this.humanPop,
            weightData: this.weightData,
            rootData: this.rootData,
            seedData: this.seedData,
            energyData: this.energyData,
            dispersalData: this.dispersalData
        }
    };

    if (socket) socket.emit("insert", data);
};

Automata.prototype.nextRun = function () {
    const harvest = document.getElementById("seed_selection");
    const plant = document.getElementById("plant_selection");

    const options = ["none", "random", "weight", "deepRoots", "fecundity", "fruitEnergy", "dispersal", "minweight", "mindeepRoots", "minfecundity", "minfruitEnergy", "mindispersal"];
    // const options = ["none", "random", "weight", "deepRoots", "fecundity", "minweight", "mindeepRoots", "minfecundity"];

    if (harvest.value === "none" && plant.value === "none") {
        harvest.value = "random";
    } else {
        plant.value = options[(options.indexOf(plant.value) + 1) % options.length];
        if (plant.value === "none") {
            const harvestIndex = (options.indexOf(harvest.value) + 1) % options.length;
            harvest.value = options[harvestIndex];
        }
        if(plant.value === "weight" && harvest.value !== "random") {
            const harvestIndex = (options.indexOf(harvest.value) + 1) % options.length;
            harvest.value = options[harvestIndex];
            plant.value = "none";
        }
    }
};

Automata.prototype.updateParams = function () {
    // var val = parseInt(document.getElementById("seed_selection").value) % 16;

    // document.getElementById("seed_selection").value = val; // change seed selection strategy
    // if (val === 15) document.getElementById("human_add_rate").value = "0"; // last run has no humans
    // if (val === 0) document.getElementById("human_add_rate").value = "0.05"; // reset to add humans in next iteration

    loadParameters();
};

Automata.prototype.update = function () {
    var flood = Math.random() < params.floodRate;
    var drought = Math.random() < params.droughtRate;

    this.day++;
    if (this.day === params.humansAdded) this.addHumans(2);

    if (this.day === params.epoch) {
        this.logData();
        this.reset();
    }
    //reenable below for floods/droughts

    //if (this.day % params.seasonLength === 0) this.season = (this.season + 1) % 4;

    //for (var i = 0; i < params.dimension; i++) {
    //	for (var j = 0; j < params.dimension; j++) {
    //	    if (this.season === 1 && flood) { // spring flood
    //	        this.board[i][j].flood();
    //	    }
    //	    if (this.season === 3 && drought) { // autumn drought
    //	        this.board[i][j].drought();
    //	    }

    //	    this.board[i][j].update();
    //	}
    //}

    for (var i = this.seeds.length - 1; i >= 0; i--) {
        var seed = this.seeds[i];
        seed.update();
    }

    for (var i = this.humans.length - 1; i >= 0; i--) {
        var human = this.humans[i];
        human.update();
        if (human.dead) {
            this.humans.splice(i, 1);
            human.cell.removeHuman(human);
        }
    }

    for (var i = this.seeds.length - 1; i >= 0; i--) {
        var seed = this.seeds[i];
        if (seed.dead) {
            this.seeds.splice(i, 1);
            seed.cell.removeSeed(seed);
            seed.spreadSeeds();
        }
    }

    this.partitionSeeds();

    // data gathering
    if (this.day % params.reportingPeriod === 0) {
        this.updateData();
    }

};

Automata.prototype.draw = function (ctx) {
    for (var i = 0; i < params.dimension; i++) {
        for (var j = 0; j < params.dimension; j++) {
            var cell = this.board[i][j];
            cell.draw(ctx);
        }
    }

    ctx.font = "12px Arial";
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    ctx.fillText(`Seeds in Shelter: ${this.shelter.seeds.length}`, 810, 710);
    ctx.fillText(`Seeds to Plant: ${this.shelter.plantSeeds.length}`, 810, 724);
    ctx.fillText(`Water in Shelter: ${this.shelter.water}`, 810, 738);
    ctx.fillText(`Tick ${this.game.clockTick}`, 810, 766);
    ctx.fillText(`FPS ${this.game.timer.ticks.length}`, 810, 780);
    ctx.font = "10px Arial";
   
};