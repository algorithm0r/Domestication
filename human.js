function Human(human) {
    this.game = human.game;
    this.x = human.x;
    this.y = human.y;
    this.cell = human.cell;

    // metabolic properties
    this.thirst = 0;
    this.hunger = 0;
    this.tired = 0;

    // resources carried
    this.water = 0;
    this.seeds = [];
    this.toPlant = [];

    // behavioral properties
    this.plantSelectionProperty = params.plantStrategy; // uses the current setting 

    // display properties
    this.color = "red";

    this.parent = true;
};

Human.prototype.spendEnergy = function () {
    var r = randomInt(3);
    if (r === 0) this.thirst++;
    else if (r === 1) this.hunger++;
    else this.tired++;
    if (this.thirst > params.metabolicThreshold || this.hunger > params.metabolicThreshold || this.tired > params.metabolicThreshold) {
        return true;
    }
    return false;
};


//     } else if (selectionProperty.substring(0, 3) == "min") {
//         selectionProperty = selectionProperty.slice(3);
//         var avg = seeds.reduce((p, c) => p + (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]), 0) / seeds.length;     
//     } else {
//         var avg = seeds.reduce((p, c) => p + (c[selectionProperty].value ?? c[selectionProperty].length ?? c[selectionProperty]), 0) / seeds.length;


Human.prototype.move = function (cell) {
    this.cell.removeHuman(this);
    cell.addHuman(this);
    if (cell.shelter) {
        cell.shelter.water += this.water;
        
        let selectionProperty = this.plantSelectionProperty;
        if (params.individualSeedSeparation && selectionProperty != "none" && this.game.board.day > params.plantingTime) {
            let diff = Math.floor(this.seeds.length*params.plantSelectionStrength);
            if (diff > 0) {
                if(selectionProperty != "random" && selectionProperty != "bottom" && selectionProperty != "top") {
                    if (selectionProperty.substring(0, 3) == "min") {
                        selectionProperty = selectionProperty.slice(3);
                        this.seeds.sort((a, b) => {
                            return (a[selectionProperty]?.value ?? a[selectionProperty]?.length ?? a[selectionProperty])
                            - (b[selectionProperty]?.value ?? b[selectionProperty]?.length ?? b[selectionProperty]); 
                        });
                    } else {
                        this.seeds.sort((a, b) => {
                            return (b[selectionProperty]?.value ?? b[selectionProperty]?.length ?? b[selectionProperty])
                            - (a[selectionProperty]?.value ?? a[selectionProperty]?.length ?? a[selectionProperty]);
                        });
                    }
                } else if (selectionProperty == "random" || Math.random() > params.plantSelectionChance) {
                    shuffleArray(this.seeds);
                }

                if(params.sharedPlantingSeeds) { // add planting seeds to collective store
                    if(selectionProperty == "top") cell.shelter.plantSeeds.push(...this.seeds.splice(this.seeds.length - diff));
                    else cell.shelter.plantSeeds.push(...this.seeds.splice(0, diff)); 
                } else this.toPlant.push(...this.seeds.splice(0, diff)); // move planting seeds to personal planting basket
            }
        }

        cell.shelter.seeds.push(...this.seeds);
        this.seeds = [];
        this.water = 0;
    }

    if (this.seeds.length > 0 && Math.random() < params.seedDropRate) {
        this.dropSeeds();
    }

    if (this.toPlant.length > 0 && this.game.board.day > params.plantingTime) {
        this.cultivate();
    }
};

Human.prototype.cultivate = function () {
    var [seed] = this.toPlant.splice(0, 1);
    this.cell.addSeed(seed, 2);
};

Human.prototype.dropSeeds = function () {
    var dropSize = Math.min(this.seeds.length, randomInt(params.maxSeedDrop) + 1);

    var seeds = this.seeds.splice(0, dropSize);
    for (var i = 0; i < seeds.length; i++) {
        seeds[i].cell = this.cell;
        seeds[i].x = this.x;
        seeds[i].y = this.y;
        seeds[i].seeds = 1;
        seeds[i].spreadSeeds();
    }
};

Human.prototype.rest = function () {
    var shelter = this.cell.shelter;

    // sleep
    this.tired = Math.max(this.tired - params.metabolicUnit, 0);

    //drink
    if (/*shelter.water > 0 &&*/ this.thirst > 0) {
        // var val = Math.min(shelter.water, params.metabolicUnit);
        var val = params.metabolicUnit;
        shelter.water -= val;
        this.thirst -= val;
    }

    // eat
    if (shelter.seeds.length > 0 || shelter.plantSeeds.length > 0) {
        var seeds = shelter.seeds.length > 0 ? shelter.seeds : shelter.plantSeeds;
        var val = Math.min(seeds.length, params.metabolicUnit);
        for (var i = 0; i < val; i++) {
            var seed = seeds.splice(0, 1)[0];
            this.hunger -= params.seedsDiffMetabolism ? seed.energy : 1;
        }
    }

    // fill planting seeds
    if (this.toPlant.length < params.basketSize && shelter.plantSeeds.length > 0) {
        var diff = Math.min(params.scoopSize, params.plantBasketSize - this.toPlant.length);
        this.toPlant.push(...shelter.plantSeeds.splice(0, diff));
    }
};

Human.prototype.moveToShelter = function () {
    var cell = this.cell;
    var c = [[cell.northwest, cell.north, cell.northeast], [cell.west, cell, cell.east], [cell.southwest, cell.south, cell.southeast]];

    var shelters = [];
    // if there is a shelter in range move to it
    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            if (c[i][j] && c[i][j].shelter)
                shelters.push(c[i][j]);
        }
    }

    if (shelters.length > 0) {
        var cell = shelters[randomInt(shelters.length)];
        this.move(cell);
        return;
    }

    //if no shelter in range wander randomly away from the river
    if (this.x < params.dimension / 2) {
        if (c[0][0]) shelters.push(c[0][0]);
        if (c[1][0]) shelters.push(c[1][0]);
        if (c[2][0]) shelters.push(c[2][0]);
    } else {
        if (c[0][2]) shelters.push(c[0][2]);
        if (c[1][2]) shelters.push(c[1][2]);
        if (c[2][2]) shelters.push(c[2][2]);
    }
    if (shelters.length === 0) {
        if (c[0][1]) shelters.push(c[0][1]);
        if (c[2][1]) shelters.push(c[2][1]);
    }
    var cell = shelters[randomInt(shelters.length)];
    this.move(cell);
};

// Harvest-preference table: gene key + direction (+1 = max, -1 = min).
const HARVEST = {
    weight:      { key: 'weight',      dir:  1 }, minweight:      { key: 'weight',      dir: -1 },
    deepRoots:   { key: 'deepRoots',   dir:  1 }, mindeepRoots:   { key: 'deepRoots',   dir: -1 },
    fecundity:   { key: 'fecundity',   dir:  1 }, minfecundity:   { key: 'fecundity',   dir: -1 },
    dispersal:   { key: 'dispersal',   dir:  1 }, mindispersal:   { key: 'dispersal',   dir: -1 },
    fruitEnergy: { key: 'fruitEnergy', dir:  1 }, minfruitEnergy: { key: 'fruitEnergy', dir: -1 },
};

// Pick which in-range seeds a human prefers, per params.harvestStrategy:
//   "random"             -> every viable seed (caller picks one at random)
//   "<gene>"/"min<gene>" -> the seed(s) with the max/min of that gene (ties kept)
//   "none"/unknown       -> nothing
// Replaces a ~290-line switch of near-identical cases. The original's
// unreachable numeric cases (penalty 3/4, seed-energy 13/14) are dropped.
Human.prototype.selectSeed = function (cells) {
    var cand = [];
    for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        for (var j = 0; j < c.seeds.length; j++) {
            var s = c.seeds[j];
            if (!s.dead && s.seeds > 0) cand.push({ c: c, j: j, s: s });
        }
    }
    if (cand.length === 0) return { cell: [], seed: [] };

    if (params.harvestStrategy === "random") {
        return { cell: cand.map(function (x) { return x.c; }),
                 seed: cand.map(function (x) { return x.j; }) };
    }

    var rule = HARVEST[params.harvestStrategy];
    if (!rule) return { cell: [], seed: [] };   // "none" or unrecognized

    var val = function (x) { var p = x.s[rule.key]; return (p && typeof p === "object") ? p.value : p; };
    var best = val(cand[0]);
    for (var k = 1; k < cand.length; k++) { var v = val(cand[k]); if (rule.dir * v > rule.dir * best) best = v; }

    var cell = [], seed = [];
    for (var k = 0; k < cand.length; k++) if (val(cand[k]) === best) { cell.push(cand[k].c); seed.push(cand[k].j); }
    return { cell: cell, seed: seed };
};

Human.prototype.moveToSeeds = function () {
    var cell = this.cell;
    var c = [[cell.northwest, cell.north, cell.northeast], [cell.west, cell, cell.east], [cell.southwest, cell.south, cell.southeast]];

    var cells = [];
    // if there are seeds in range move to it
    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            if (c[i][j] && c[i][j].seeds.length > 0)
                cells.push(c[i][j]);
        }
    }

    if (cells.length > 0) {
        var cc = this.selectSeed(cells);
        if (cc.cell.length === 0) {
            this.moveRandom();
            return;
        }
        var sel = randomInt(cc.cell.length);
        var ce = cc.cell[sel];
        this.move(ce);
        this.seeds.push(...ce.seeds[cc.seed[sel]].pluckSeeds());
    } else {
        this.moveRandom();
    }
};

Human.prototype.moveRandom = function () {
    var cell = this.cell;
    var c = [];
    if (cell.north) c.push(cell.north);
    if (cell.northwest) c.push(cell.northwest);
    if (cell.northeast) c.push(cell.northeast);
    if (cell.south) c.push(cell.south);
    if (cell.southwest) c.push(cell.southwest);
    if (cell.southeast) c.push(cell.southeast);
    if (cell.east) c.push(cell.east);
    if (cell.west) c.push(cell.west);
    this.move(c[randomInt(c.length)]);
};

Human.prototype.selectWaterCell = function (cells) {
    var cell = [cells[0]];

    for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.water === cell[0].water) cell.push(c);
        if (c.water > cell[0].water) cell = [c];
    }

    return cell[randomInt(cell.length)];
};

Human.prototype.moveToWater = function () {
    var cell = this.cell;
    var c = [[cell.northwest, cell.north, cell.northeast], [cell.west, cell, cell.east], [cell.southwest, cell.south, cell.southeast]];

    var cells = [];
    // if there is water in range move to it
    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            if (c[i][j] && c[i][j].water > 0)
                cells.push(c[i][j]);
        }
    }

    if (cells.length > 0) {
        var c = this.selectWaterCell(cells);
        this.move(c);
        this.water += Math.min(this.cell.water, params.scoopSize); // take scoop
        this.water = Math.min(this.water, params.skinSize); // max water is skinSize
    } else {
        this.moveToRiver();
    }

};

Human.prototype.moveToRiver = function () {
    var cell = this.cell;

    var cells = [];
    if (this.x < params.dimension / 2) {
        if (cell.northeast) cells.push(cell.northeast);
        if (cell.east) cells.push(cell.east);
        if (cell.southeast) cells.push(cell.southeast);
    } else {
        if (cell.northwest) cells.push(cell.northwest);
        if (cell.west) cells.push(cell.west);
        if (cell.southwest) cells.push(cell.southwest);
    }
    var cell = cells[randomInt(cells.length)];
    if (cell) this.move(cell);
};

Human.prototype.update = function () {
    var cell = this.cell;

    //if (Math.random() < 0.001) this.dead = true;

    if (cell.shelter) {
        if (this.tired > 0 || (this.thirst > 0 && this.cell.shelter.water > 0) || (this.hunger > -params.metabolicThreshold && cell.shelter.seeds.length > 0 && !this.parent)) {
            this.rest();
            return;
        }
        // if (this.hunger > 0 && cell.shelter.seeds.length === 0 || this.thirst > 0 && cell.shelter.water === 0) {
        //     this.dead = true;
        //     return;
        // }
        // if (this.hunger < -params.metabolicThreshold) {
        //     var h = new Human(this);
        //     this.game.board.humans.push(h);
        //     this.cell.addHuman(h);
        //     this.hunger += params.metabolicThreshold;
        //     this.parent = true;
        //     return;
        // }
    }
    this.parent = false;
    if (this.spendEnergy() || (this.water >= params.skinSize && this.seeds.length >= params.basketSize)) {
        this.moveToShelter();
        return;
    } else {
        if (this.seeds.length < params.basketSize) {
            this.moveToSeeds();
        }
        if (this.water < params.skinSize) {
            this.moveToWater();
        }
    }
};

Human.prototype.draw = function (ctx) {
    var size = params.size / 2;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc((this.x * params.size) + (params.size / 2), (this.y * params.size) + (params.size / 2), (size / 2), 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.closePath();
};