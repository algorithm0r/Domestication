function Seed(seed) {
    this.cell = seed.cell;
    this.game = seed.cell.game;
    this.x = seed.cell.x;
    this.y = seed.cell.y;

    // init
    this.seeds = 0;
    this.growth = 0;

    // genes
    if (params.randomSeeds) {
        this.weight = seed.weight ? new RealGene(seed.weight) : new RealGene();
        this.deepRoots = seed.deepRoots ? new RealGene(seed.deepRoots) : new RealGene();
        this.fecundity = seed.fecundity ? new RealGene(seed.fecundity) : new RealGene();
        this.fruitEnergy = seed.fruitEnergy ? new RealGene(seed.fruitEnergy) : new RealGene();
        this.dispersal = seed.dispersal ? new RealGene(seed.dispersal) : new RealGene();
    } else {
        this.weight = seed.weight ? new RealGene(seed.weight) : new RealGene({ value: 0.5 });
        this.deepRoots = seed.deepRoots ? new RealGene(seed.deepRoots) : new RealGene();
        this.fecundity = seed.fecundity ? new RealGene(seed.fecundity) : new RealGene({ value: 1 });
        this.fruitEnergy = seed.fruitEnergy ? new RealGene(seed.fruitEnergy) : new RealGene({ value: 0 });
        this.dispersal = seed.dispersal ? new RealGene(seed.dispersal) : new RealGene({ value: 0 });
    }
    this.mutate();

    this.penalty = this.weight.value + this.deepRoots.value + this.fecundity.value + this.fruitEnergy.value + this.dispersal.value;
    this.energy = this.fruitEnergy.value + 1 - this.penalty / 5;
    //this.energy = 1;
    //console.log(this.penalty);
};

Seed.prototype.update = function () {
    var range = params.riverWidth - params.dry + 1;
    var oldGrowth = this.growth;
    this.growth += (1 - this.deepRoots.value) * (this.cell.water - params.dry) + this.deepRoots.value * range / 2; // grow in range [0,...,range]

    var threshold = params.germThreshold + this.penalty * params.growthPenalty;
    if (this.growth > threshold && oldGrowth < threshold) { // germinate
        var r = randomInt(range) + this.cell.water + this.fecundity.value * range - params.riverWidth;
        this.seeds = r < 0 ? 0 :
            r < 0.25 * range ? 1 :
            r < 0.5 * range ? 2 :
            r < 0.75 * range ? 3 : 4;
        if (this.seeds === 0) this.dead = true;
    }

    if (this.growth > threshold + (params.fullgrown * (1 - this.dispersal.value)) || Math.random() < params.seedDeathChance) { // die
        this.dead = true;
    }
};

Seed.prototype.draw = function (ctx, i) {
    var penalty = Math.floor(this.penalty / 4 * 255);
    ctx.fillStyle = rgb(0, 255 - penalty, 0);
    ctx.fillRect(this.x * params.size + (i % 2) * params.size * 3 / 4, this.y * params.size + Math.floor(i / 2) * params.size * 3 / 4, params.size / 4, params.size / 4);
};

Seed.prototype.mutate = function () {
    this.weight.mutate();
    this.deepRoots.mutate();
    this.fecundity.mutate();
    this.fruitEnergy.mutate();
    this.dispersal.mutate();
};

Seed.prototype.pluckSeeds = function () {
    var pluckRate = 0.75;
    var list = [];

    for (var i = 0; i < this.seeds;) {
        if (Math.random() < pluckRate) {
            var seed = new Seed(this);
            list.push(seed);
            this.seeds--;
        } else {
            i++;
        }
    }
    this.dead = true;

    return list;
};

Seed.prototype.spreadSeeds = function () {
    for (var i = 0; i < this.seeds; i++) {
        if (Math.random() >= this.weight.value) {
            this.cell.addSeed(this);
        } else {
            var randomCell = (5 + randomInt(8)) % 9;
            var dX = (randomCell % 3) - 1;
            var dY = Math.floor(randomCell / 3) - 1;
            var x = this.x + dX < 0 || this.x + dX > params.dimension - 1 ? this.x : this.x + dX;
            var y = this.y + dY < 0 || this.y + dY > params.dimension - 1 ? this.y : this.y + dY;
            var cell = this.game.board.board[x][y];

            cell.addSeed(this);
        }
    }
};

