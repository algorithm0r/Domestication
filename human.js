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
    this.dropRate = 0.1;
    this.maxDrop = 3;

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

Human.prototype.move = function(cell) {
    this.cell.removeHuman(this);
    cell.addHuman(this);
    if (cell.shelter) {
        cell.shelter.water += this.water;
        cell.shelter.seeds.push(...this.seeds);
        this.seeds = [];
        this.water = 0;
    }

    if (this.seeds.length > 0 && Math.random() < params.seedDropRate) {
        this.dropSeeds();
    }

    if (this.toPlant.length > 0 && cell.seeds.length < 4) {
        this.cultivate();
    }
};

Human.prototype.cultivate = function () {
    var [seed] = this.toPlant.splice(0, 1);
    this.cell.addSeed(seed);
};

Human.prototype.dropSeeds = function () {
    var dropSize = Math.min(this.seeds.length, randomInt(params.maxSeedDrop) + 1);

    // this.seeds.sort((s1,s2)=>(s1.energy>s2.energy) ? 1 : (s2.energy < s1.energy) ? -1 : 0);
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
    if (shelter.water > 0 && this.thirst > 0) {
        var val = Math.min(shelter.water, params.metabolicUnit);
        shelter.water -= val;
        this.thirst -= val;
    }

    // eat
    if (shelter.seeds.length > 0 || shelter.plantSeeds.length > 0) {
        var seeds = shelter.seeds.length > 0 ? shelter.seeds : shelter.plantSeeds;
        var val = Math.min(seeds.length, params.metabolicUnit);
        for (var i = 0; i < val; i++) {
            var seed = seeds.splice(0, 1)[0];
            //console.log(seed[0].penalty);
            this.hunger -= params.seedsDiffMetabolism ? seed.energy : 1;
        }
    }

    // fill planting seeds
    if(this.toPlant.length < params.basketSize && shelter.plantSeeds.length > 0) {
        var diff = Math.min(params.scoopSize, params.plantBasketSize - this.toPlant.length);
        this.toPlant.push(...shelter.plantSeeds.splice(0,diff));
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

Human.prototype.selectSeed = function (cells) {
    var cell = [];
    var seed = [];

    switch (params.seedStrategy) {
        case "random": // random seed
            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && c.seeds[j].seeds > 0) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case 1: // most seeds
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || (cell.length > 0 && c.seeds[j].seeds > cell[0].seeds[seed[0]].seeds))) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead &&  (cell.length > 0 && c.seeds[j].seeds === cell[0].seeds[seed[0]].seeds)) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case 2: // fewest seeds
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (cell.length === 0) {
                        if (!c.seeds[j].dead && c.seeds[j].seeds > 0) {
                            cell = [c];
                            seed = [j];
                        }
                    } else if (!c.seeds[j].dead && c.seeds[j].seeds > 0 && c.seeds[j].seeds < cell[0].seeds[seed[0]].seeds) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && c.seeds[j].seeds === cell[0].seeds[seed[0]].seeds) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case 3: // min penalty
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].penalty < cell[0].seeds[seed[0]].penalty)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].penalty === cell[0].seeds[seed[0]].penalty) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case 4: // max penalty
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].penalty > cell[0].seeds[seed[0]].penalty)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].penalty === cell[0].seeds[seed[0]].penalty) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "mindeepRoots": // min roots
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].deepRoots.value < cell[0].seeds[seed[0]].deepRoots.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].deepRoots.value === cell[0].seeds[seed[0]].deepRoots.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "deepRoots": // max roots
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].deepRoots.value > cell[0].seeds[seed[0]].deepRoots.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].deepRoots.value === cell[0].seeds[seed[0]].deepRoots.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "minweight": // min weight
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].weight.value < cell[0].seeds[seed[0]].weight.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].weight.value === cell[0].seeds[seed[0]].weight.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "weight": // max weight
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].weight.value > cell[0].seeds[seed[0]].weight.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].weight.value === cell[0].seeds[seed[0]].weight.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "mindispersal": // min dispersal
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].dispersal.value < cell[0].seeds[seed[0]].dispersal.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].dispersal.value === cell[0].seeds[seed[0]].dispersal.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "dispersal": // max dispersal
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].dispersal.value > cell[0].seeds[seed[0]].dispersal.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].dispersal.value === cell[0].seeds[seed[0]].dispersal.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "minfruitEnergy": // min energy
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].fruitEnergy.value < cell[0].seeds[seed[0]].fruitEnergy.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].fruitEnergy.value === cell[0].seeds[seed[0]].fruitEnergy.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case "fruitEnergy": // max energy
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].fruitEnergy.value > cell[0].seeds[seed[0]].fruitEnergy.value)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].fruitEnergy.value === cell[0].seeds[seed[0]].fruitEnergy.value) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case 13: // min seed energy
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].energy < cell[0].seeds[seed[0]].energy)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].energy === cell[0].seeds[seed[0]].energy) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
        case 14: // max seed energy
            cell = [];
            seed = [];

            for (var i = 0; i < cells.length; i++) {
                var c = cells[i];
                for (var j = 0; j < c.seeds.length; j++) {
                    if (!c.seeds[j].dead && ((cell.length === 0 && c.seeds[j].seeds > 0) || c.seeds[j].seeds > 0 && c.seeds[j].energy > cell[0].seeds[seed[0]].energy)) {
                        cell = [c];
                        seed = [j];
                    } else if (!c.seeds[j].dead && cell.length > 0 && c.seeds[j].seeds > 0 && c.seeds[j].energy === cell[0].seeds[seed[0]].energy) {
                        cell.push(c);
                        seed.push(j);
                    }
                }
            }
            break;
    }
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
    ctx.arc((this.x *params.size) + (params.size / 2), (this.y * params.size) + (params.size / 2), (size / 2), 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.closePath();
};