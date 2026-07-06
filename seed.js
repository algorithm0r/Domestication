class Seed {
    constructor(seed) {
        this.cell = seed.cell;
        
        this.x = seed.cell.x;
        this.y = seed.cell.y;

        // init
        this.seeds = 0;
        this.growth = 0;

        // lineage tags (lineage experiment): how this seed came to be. Minted fresh on every
        // seed and NOT inherited — set only when a human sows it / plucks it. Read solely by the
        // gated plant-lineage branch in human.move(); inert when params.plantLineage === "off".
        this.planted = false;       // true iff a human sowed THIS seed (set in cultivate -> addSeed)
        this.fromPlanted = false;   // true iff this grain was plucked from a sown plant (set in pluckSeeds)
        // gens-since-planted: INHERITED through every reproduction (+1/gen via this constructor) and
        // RESET to 0 only when a human sows the seed (cell.addSeed, planted=true). 9999 = never-planted
        // (wild). Selection mode "mingsp" plants the lowest-counter seeds (closest to the planted line).
        this.gsp = (typeof seed.gsp === 'number') ? seed.gsp + 1 : 9999;

        // genes
        if (params.randomSeeds) {
            this.weight = seed.weight ? new RealGene(seed.weight) : new RealGene();
            this.deepRoots = seed.deepRoots ? new RealGene(seed.deepRoots) : new RealGene();
            this.fecundity = seed.fecundity ? new RealGene(seed.fecundity) : new RealGene();
            // this.fruitEnergy = seed.fruitEnergy ? new RealGene(seed.fruitEnergy) : new RealGene();
            this.dispersal = seed.dispersal ? new RealGene(seed.dispersal) : new RealGene();
        } else {
            this.weight = seed.weight ? new RealGene(seed.weight) : new RealGene({ value: 0.5 });
            this.deepRoots = seed.deepRoots ? new RealGene(seed.deepRoots) : new RealGene();
            this.fecundity = seed.fecundity ? new RealGene(seed.fecundity) : new RealGene({ value: 1 });
            // this.fruitEnergy = seed.fruitEnergy ? new RealGene(seed.fruitEnergy) : new RealGene({ value: 0 });
            this.dispersal = seed.dispersal ? new RealGene(seed.dispersal) : new RealGene({ value: 0 });
        }
        this.mutate();

        // this.penalty = this.weight.value + this.deepRoots.value + this.fecundity.value + this.fruitEnergy.value + this.dispersal.value;
        // this.energy = this.fruitEnergy.value;
        this.penalty = this.weight.value + this.deepRoots.value + this.fecundity.value + this.dispersal.value;
        this.growthUnit = (1 - this.deepRoots.value) * (this.cell.water - params.dry) + this.deepRoots.value * params.range / 2;
        
        this.threshold = Math.ceil((params.germThreshold + this.penalty * params.growthPenalty)/this.growthUnit);
        // this.threshold = params.germThreshold + this.penalty * params.growthPenalty;
        this.dropThreshold = this.threshold + ((params.fullGrown * (1 - this.dispersal.value))/this.growthUnit) + 1;

        //this.energy = 1;
    }
    update() {
        this.growth++;

        if (this.growth === this.threshold) { // germinate
            var r = randomInt(params.range) + (this.cell.water - params.riverWidth) + this.fecundity.value * params.range;
            this.seeds = Math.max(0, Math.ceil(r / params.range * 4));
            if (this.seeds === 0) this.dead = true;
        }

        if (this.growth > this.dropThreshold || Math.random() < params.seedDeathChance) { // die
            this.dead = true;
        }

        if (params.predationChance > 0 && this.isMature() && Math.random() < params.predationChance) {
            this.pluckSeeds();   // guard: skip the per-seed RNG draw entirely when predation is off (every Domestication run) — saves ~1 Math.random()/seed/tick
        }
    }
    draw(ctx, i) {
        var penalty = Math.floor(this.deepRoots.value * 255);
        ctx.fillStyle = rgb(0, 255 - penalty, 0);
        ctx.fillRect(this.x * params.size + (i % 2) * params.size * 3 / 4, this.y * params.size + Math.floor(i / 2) * params.size * 3 / 4, params.size / 4, params.size / 4);
    }
    mutate() {
        this.weight.mutate();
        this.deepRoots.mutate();
        this.fecundity.mutate();
        // this.fruitEnergy.mutate();
        this.dispersal.mutate();
    }
    pluckSeeds() {
        var pluckRate = params.pluckRate;
        var list = [];

        for (var i = 0; i < this.seeds;) {
            if (Math.random() < pluckRate) {
                var seed = new Seed(this);
                seed.fromPlanted = this.planted;   // grain records whether its parent plant was sown (one step; not propagated further)
                list.push(seed);
                this.seeds--;
            } else {
                i++;
            }
        }
        this.dead = true;

        return list;
    }
    spreadSeeds() {
        for (var i = 0; i < this.seeds; i++) {
            if (Math.random() >= this.weight.value) {
                this.cell.addSeed(this, 0);
            } else {
                var randomCell = (5 + randomInt(8)) % 9;
                var dX = (randomCell % 3) - 1;
                var dY = Math.floor(randomCell / 3) - 1;
                var x = this.x + dX < 0 || this.x + dX > params.dimension - 1 ? this.x : this.x + dX;
                var y = this.y + dY < 0 || this.y + dY > params.dimension - 1 ? this.y : this.y + dY;
                var cell = gameEngine.board.board[x][y];

                cell.addSeed(this, 0);
            }
        }
    }

    isMature() {
        return this.growth >= this.threshold;
    }
};






