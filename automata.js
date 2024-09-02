class Automata {
    constructor() {
        gameEngine.board = this;
        this.x = 0;
        this.y = 0;

        this.run = 0;

        loadParameters();
        this.buildAutomata();
    }
    buildAutomata() {

        gameEngine.entities = [];
        gameEngine.addEntity(this);
        gameEngine.graphs = [];

        this.dataMan = new DataManager(this);
        gameEngine.addGraph(this.dataMan);

        this.day = 0;
        this.shelter = { water: 0, seeds: [], plantSeeds: [] };

        // agents
        this.seeds = [];
        this.humans = [];

        this.board = [];

        this.createBoard();
    }
    createBoard() {
        for (var i = 0; i < params.dimension; i++) {
            this.board.push([]);
            for (var j = 0; j < params.dimension; j++) {
                this.board[i].push(new Cell(gameEngine, i, j, this));
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
    }
    partitionSeeds() {
        var seeds = this.shelter.seeds;
        var plant = [];

        // var selections = ["weight","deepRoots","fecundity","fruitEnergy","dispersal"];
        // var selectionProperty = selections[randomInt(selections.length)];
        var selectionProperty = params.plantStrategy;

        if (seeds.length > 0 && this.shelter.plantSeeds.length < seeds.length / 4 && this.day > params.plantingTime) {
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
    }
    generateRiver() {
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
    }
    plantSeeds() {
        for (var i = 0; i < params.dimension; i++) {
            for (var j = 0; j < params.dimension; j++) {
                if (Math.random() < 0.1) {
                    var seed = new Seed({ cell: this.board[i][j] });
                    this.board[i][j].addSeed(seed, 0);
                    this.seeds.push(seed);
                }
            }
        }
    }
    addHumans(numOfHumans) {
        for (var i = 0; i < numOfHumans; i++) {
            var shelterRow = randomInt(params.dimension);
            var shelterCol = Math.random() > 0.5 ? 0 : params.dimension - 1;
            var human = new Human({ game: gameEngine, x: shelterRow, y: shelterCol, cell: this.board[shelterRow][shelterCol] });
            this.board[shelterRow][shelterCol].addHuman(human);
            this.humans.push(human);
        }
    }
    addShelters() {
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
    }

    reset() {
        this.nextRun();
        loadParameters();
        this.buildAutomata();
    }
    nextRun() {
        const harvest = document.getElementById("seed_selection");
        const plant = document.getElementById("plant_selection");
        const human = document.getElementById("human_add_rate");
        const run = document.getElementById("run");
        const chance = document.getElementById("plantSelectionChance");
        const strength = document.getElementById("plantSelectionStrength");
        const indiv = document.getElementById("individualSeedSeparation");
        const share = document.getElementById("sharedPlantingSeeds");


        // update params
        this.run = (this.run + 1) % runs.length;
        Object.assign(params, runs[this.run]);

        // update HTML
        run.innerHTML = params.runName;
        harvest.value = params.harvestStrategy;
        plant.value = params.plantStrategy;
        human.value = params.humanAddRate;
        chance.value = params.plantSelectionChance;
        strength.value = params.plantSelectionStrength;
        indiv.checked = params.individualSeedSeparation;
        share.checked = params.sharedPlantingSeeds;
    }
    update() {
        this.day++;
        if (this.day === params.humansAdded) this.addHumans(params.humanAddRate);

        if (this.day > params.epoch) {
            this.dataMan.logData();
            this.reset();
        }

        for (var i = 0; i < params.dimension; i++) {
            for (var j = 0; j < params.dimension; j++) {
                this.board[i][j].update();
            }
        }

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

        if (!params.individualSeedSeparation) this.partitionSeeds();
        if (this.shelter.seeds.length > 2000) {
            this.shelter.seeds.splice(0, this.shelter.seeds.length - 2000);
        }
        if (this.shelter.plantSeeds.length > 2000) {
            this.shelter.plantSeeds.splice(0, this.shelter.plantSeeds.length - 2000);
        }


        // data gathering
        if (this.day % params.reportingPeriod === 0) {
            this.dataMan.updateData();
        }
        if (this.day % params.reportingPeriod === 0) {
            this.dataMan.draw(gameEngine.ctx);
        }
    }
    draw(ctx) {
        
        for (var i = 0; i < params.dimension; i++) {
            for (var j = 0; j < params.dimension; j++) {
                var cell = this.board[i][j];
                cell.draw(ctx);
            }
        }

        ctx.clearRect(800, 700, 800, 200);
        ctx.font = "12px Arial";
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.fillText(`Seeds in Shelter: ${this.shelter.seeds.length}`, 810, 710);
        ctx.fillText(`Seeds to Plant: ${this.shelter.plantSeeds.length}`, 810, 724);
        // ctx.fillText(`Water in Shelter: ${this.shelter.water}`, 810, 738);
        ctx.fillText(`Tick ${gameEngine.clockTick}`, 810, 766);
        ctx.fillText(`FPS ${gameEngine.timer.ticks.length}`, 810, 780);
        ctx.font = "10px Arial";

    }
};













