// histogram buckets: gene value in [0,1] -> 0..19; gsp (0..9999) -> 0..19 (top bin = deep-wild lineage)
function gbucket(v) { var b = Math.floor(v * 20); return b < 0 ? 0 : (b > 19 ? 19 : b); }
function gspBucket(g) { var b = Math.floor(g); return b < 0 ? 0 : (b > 19 ? 19 : b); }

class DataManager {
    constructor(automata) {
        this.automata = automata;

        this.initData();
    }

    initData() {
        // population graphs
        this.seedPop = [];
        this.humanPop = [];

        this.wildSeedPop = [];
        this.domeSeedPop = [];

        // seed histograms
        this.weightData = [];
        this.rootData = [];
        this.seedData = [];
        this.dispersalData = [];
        this.weightDataWild = [];
        this.rootDataWild = [];
        this.seedDataWild = [];
        this.dispersalDataWild = [];
        this.weightDataDomesticated = [];
        this.rootsDataDomesticated = [];
        this.seedDataDomesticated = [];
        this.dispersalDataDomesticated = [];

        // gsp (generations-since-planted / lineage) for the standing population (all/wild/dome)
        this.gspData = [];
        this.gspDataWild = [];
        this.gspDataDomesticated = [];

        // planted-seed event distributions (what humans SOW, per reporting period): 4 genes + gsp + count
        this.plantedWeightData = [];
        this.plantedRootData = [];
        this.plantedSeedData = [];
        this.plantedDispersalData = [];
        this.plantedGspData = [];
        this.plantCountData = [];
        // harvested-seed event distributions (what humans PLUCK — the human-predation side): 4 genes + gsp + count
        this.harvestedWeightData = [];
        this.harvestedRootData = [];
        this.harvestedSeedData = [];
        this.harvestedDispersalData = [];
        this.harvestedGspData = [];
        this.harvestCountData = [];
        this._resetEventAcc();

        // graphs
        const seedData = [this.seedPop, this.wildSeedPop, this.domeSeedPop];
        this.popGraph = new Graph(gameEngine, 810, 0, seedData, "Seed population", ["Total", "Wild", "Domesticated"]);
        // const agentData = [this.humanPop];
        // popGraph = new Graph(gameEngine, 810, 150, agentData, "Human Population");
        // gameEngine.addGraph(popGraph);

        // gene names follow the paper (weight field = Seed Dispersal, dispersal field = Abscission)
        this.weightHist = new Histogram(gameEngine, 810, 300, this.weightData, "Seed Dispersal - Full Population")
        this.rootHist = new Histogram(gameEngine, 810, 400, this.rootData, "Root Depth - Full Population");
        this.seedHist = new Histogram(gameEngine, 810, 500, this.seedData, "Fecundity - Full Population");
        this.dispersalHist = new Histogram(gameEngine, 810, 600, this.dispersalData, "Abscission - Full Population");
        this.weightHistWild = new Histogram(gameEngine, 1020, 300, this.weightDataWild, "Seed Dispersal - Wild")
        this.rootHistWild = new Histogram(gameEngine, 1020, 400, this.rootDataWild, "Root Depth - Wild");
        this.seedHistWild = new Histogram(gameEngine, 1020, 500, this.seedDataWild, "Fecundity - Wild");
        this.dispersalHistWild = new Histogram(gameEngine, 1020, 600, this.dispersalDataWild, "Abscission - Wild");
        this.weightHistDomesticated = new Histogram(gameEngine, 1230, 300, this.weightDataDomesticated, "Seed Dispersal - Domesticated")
        this.rootHistDomesticated = new Histogram(gameEngine, 1230, 400, this.rootsDataDomesticated, "Root Depth - Domesticated");
        this.seedHistDomesticated = new Histogram(gameEngine, 1230, 500, this.seedDataDomesticated, "Fecundity - Domesticated");
        this.dispersalHistDomesticated = new Histogram(gameEngine, 1230, 600, this.dispersalDataDomesticated, "Abscission - Domesticated");

        // lineage age (generations since the lineage was last planted) — standing population all/wild/dome
        this.gspHist = new Histogram(gameEngine, 810, 700, this.gspData, "Lineage age - Full Population");
        this.gspHistWild = new Histogram(gameEngine, 1020, 700, this.gspDataWild, "Lineage age - Wild");
        this.gspHistDomesticated = new Histogram(gameEngine, 1230, 700, this.gspDataDomesticated, "Lineage age - Domesticated");
        // PLANTED-seed distributions (what humans sow), stacked: lineage age + 4 genes
        // genes on rows 300-600 (matching the main grid), lineage age on the bottom row (700) so it lines up.
        // Harvested column on the left (1450), Planted on the right (1670).
        this.harvestedWeightHist = new Histogram(gameEngine, 1440, 300, this.harvestedWeightData, "Harvested - Seed Dispersal");
        this.harvestedRootHist = new Histogram(gameEngine, 1440, 400, this.harvestedRootData, "Harvested - Root Depth");
        this.harvestedSeedHist = new Histogram(gameEngine, 1440, 500, this.harvestedSeedData, "Harvested - Fecundity");
        this.harvestedDispersalHist = new Histogram(gameEngine, 1440, 600, this.harvestedDispersalData, "Harvested - Abscission");
        this.harvestedGspHist = new Histogram(gameEngine, 1440, 700, this.harvestedGspData, "Harvested - Lineage age");
        this.plantedWeightHist = new Histogram(gameEngine, 1650, 300, this.plantedWeightData, "Planted - Seed Dispersal");
        this.plantedRootHist = new Histogram(gameEngine, 1650, 400, this.plantedRootData, "Planted - Root Depth");
        this.plantedSeedHist = new Histogram(gameEngine, 1650, 500, this.plantedSeedData, "Planted - Fecundity");
        this.plantedDispersalHist = new Histogram(gameEngine, 1650, 600, this.plantedDispersalData, "Planted - Abscission");
        this.plantedGspHist = new Histogram(gameEngine, 1650, 700, this.plantedGspData, "Planted - Lineage age");
    }

    _zeros() { var a = []; for (var i = 0; i < 20; i++) a.push(0); return a; }
    _resetEventAcc() {
        this._pW = this._zeros(); this._pR = this._zeros(); this._pF = this._zeros(); this._pD = this._zeros(); this._pGsp = this._zeros(); this._pN = 0;
        this._hW = this._zeros(); this._hR = this._zeros(); this._hF = this._zeros(); this._hD = this._zeros(); this._hGsp = this._zeros(); this._hN = 0;
    }
    // called from human.cultivate() for each sown seed
    recordPlant(seed) {
        this._pW[gbucket(seed.weight.value)]++; this._pR[gbucket(seed.deepRoots.value)]++;
        this._pF[gbucket(seed.fecundity.value)]++; this._pD[gbucket(seed.dispersal.value)]++;
        this._pGsp[gspBucket(seed.gsp)]++; this._pN++;
    }
    // called from human.moveToSeeds() for each plucked seed
    recordHarvest(seed) {
        this._hW[gbucket(seed.weight.value)]++; this._hR[gbucket(seed.deepRoots.value)]++;
        this._hF[gbucket(seed.fecundity.value)]++; this._hD[gbucket(seed.dispersal.value)]++;
        this._hGsp[gspBucket(seed.gsp)]++; this._hN++;
    }

    updateData() {
        var seeds = this.automata.seeds;
      
        var seedPop = seeds.length;
        var humanPop = this.automata.humans.length;
        var wildSeedPop = 0;
        var domeSeedPop = 0;
    
        var weightData = [];
        var rootsData = [];
        var seedData = [];
        var dispersalData = [];
        var weightDataWild = [];
        var rootsDataWild = [];
        var seedDataWild = [];
        var dispersalDataWild = [];
        var weightDataDomesticated = [];
        var rootsDataDomesticated = [];
        var seedDataDomesticated = [];
        var dispersalDataDomesticated = [];
        var gspData = [], gspDataWild = [], gspDataDomesticated = [];


        for (var i = 0; i < 20; i++) {
            weightData.push(0);
            rootsData.push(0);
            seedData.push(0);
            dispersalData.push(0);
            weightDataWild.push(0);
            rootsDataWild.push(0);
            seedDataWild.push(0);
            dispersalDataWild.push(0);
            weightDataDomesticated.push(0);
            rootsDataDomesticated.push(0);
            seedDataDomesticated.push(0);
            dispersalDataDomesticated.push(0);
            gspData.push(0); gspDataWild.push(0); gspDataDomesticated.push(0);
        }

        function getHistogramBucket(value) {
            return Math.floor(value * 20) < 20 ? Math.floor(value * 20) : 19;;
        }

        for (var k = 0; k < seeds.length; k++) {
            var weightIndex = getHistogramBucket(seeds[k].weight.value);
            weightData[weightIndex]++;
            var rootsIndex = getHistogramBucket(seeds[k].deepRoots.value);
            rootsData[rootsIndex]++;
            var seedIndex = getHistogramBucket(seeds[k].fecundity.value);
            seedData[seedIndex]++;
            var dispersalIndex = getHistogramBucket(seeds[k].dispersal.value);
            dispersalData[dispersalIndex]++;
            var gspIndex = gspBucket(seeds[k].gsp);
            gspData[gspIndex]++;

            if (seeds[k].dispersal.value < params.wildDomesticThreshold) {
                domeSeedPop++;
                weightDataDomesticated[weightIndex]++;
                rootsDataDomesticated[rootsIndex]++;
                seedDataDomesticated[seedIndex]++;
                dispersalDataDomesticated[dispersalIndex]++;
                gspDataDomesticated[gspIndex]++;
            }
            else {
                wildSeedPop++;
                weightDataWild[weightIndex]++;
                rootsDataWild[rootsIndex]++;
                seedDataWild[seedIndex]++;
                dispersalDataWild[dispersalIndex]++;
                gspDataWild[gspIndex]++;
            }
        }

        this.weightData.push(weightData);
        this.rootData.push(rootsData);
        this.seedData.push(seedData);
        this.dispersalData.push(dispersalData);
        this.weightDataWild.push(weightDataWild);
        this.rootDataWild.push(rootsDataWild);
        this.seedDataWild.push(seedDataWild);
        this.dispersalDataWild.push(dispersalDataWild);
        this.weightDataDomesticated.push(weightDataDomesticated);
        this.rootsDataDomesticated.push(rootsDataDomesticated);
        this.seedDataDomesticated.push(seedDataDomesticated);
        this.dispersalDataDomesticated.push(dispersalDataDomesticated);
        this.gspData.push(gspData); this.gspDataWild.push(gspDataWild); this.gspDataDomesticated.push(gspDataDomesticated);

        // planted / harvested event distributions for this period, then reset the live accumulators
        this.plantedWeightData.push(this._pW); this.plantedRootData.push(this._pR); this.plantedSeedData.push(this._pF);
        this.plantedDispersalData.push(this._pD); this.plantedGspData.push(this._pGsp); this.plantCountData.push(this._pN);
        this.harvestedWeightData.push(this._hW); this.harvestedRootData.push(this._hR); this.harvestedSeedData.push(this._hF);
        this.harvestedDispersalData.push(this._hD); this.harvestedGspData.push(this._hGsp); this.harvestCountData.push(this._hN);
        this._resetEventAcc();

        this.seedPop.push(seedPop);
        this.humanPop.push(humanPop);
        this.wildSeedPop.push(wildSeedPop);
        this.domeSeedPop.push(domeSeedPop);
    }


    logData() {
        var data = {
            db: params.db,
            collection: params.collection,
            data: {
                params: params,
                seedPop: this.seedPop,
                humanPop: this.humanPop,
                wildSeedPop: this.wildSeedPop,
                domeSeedPop: this.domeSeedPop,
                weightData: this.weightData,
                rootData: this.rootData,
                seedData: this.seedData,
                dispersalData: this.dispersalData,
                weightDataWild: this.weightDataWild,
                rootDataWild: this.rootDataWild,
                seedDataWild: this.seedDataWild,
                dispersalDataWild: this.dispersalDataWild,
                weightDataDomesticated: this.weightDataDomesticated,
                rootDataDomesticated: this.rootsDataDomesticated,
                seedDataDomesticated: this.seedDataDomesticated,
                dispersalDataDomesticated: this.dispersalDataDomesticated,
                gspData: this.gspData, gspDataWild: this.gspDataWild, gspDataDomesticated: this.gspDataDomesticated,
                plantedWeightData: this.plantedWeightData, plantedRootData: this.plantedRootData, plantedSeedData: this.plantedSeedData,
                plantedDispersalData: this.plantedDispersalData, plantedGspData: this.plantedGspData, plantCountData: this.plantCountData,
                harvestedWeightData: this.harvestedWeightData, harvestedRootData: this.harvestedRootData, harvestedSeedData: this.harvestedSeedData,
                harvestedDispersalData: this.harvestedDispersalData, harvestedGspData: this.harvestedGspData, harvestCountData: this.harvestCountData,
            }
        };

        if (socket) socket.emit("insert", data);
    }

    update() {
    }

    draw(ctx) {
        ctx.clearRect(810, 0, ctx.canvas.width - 810, ctx.canvas.height); // clear the whole graph strip (right of the sim)

        ctx.save();
        ctx.translate(30, 0);   // nudge the whole dashboard right so its left edge clears the simulation square

        this.popGraph.draw(ctx);
        this.drawKey(ctx);

        this.weightHist.draw(ctx);
        this.rootHist.draw(ctx);
        this.seedHist.draw(ctx);
        this.dispersalHist.draw(ctx);
        this.weightHistWild.draw(ctx);
        this.rootHistWild.draw(ctx);
        this.seedHistWild.draw(ctx);
        this.dispersalHistWild.draw(ctx);
        this.weightHistDomesticated.draw(ctx);
        this.rootHistDomesticated.draw(ctx);
        this.seedHistDomesticated.draw(ctx);
        this.dispersalHistDomesticated.draw(ctx);

        this.gspHist.draw(ctx);
        this.gspHistWild.draw(ctx);
        this.gspHistDomesticated.draw(ctx);
        this.plantedGspHist.draw(ctx);
        this.plantedWeightHist.draw(ctx);
        this.plantedRootHist.draw(ctx);
        this.plantedSeedHist.draw(ctx);
        this.plantedDispersalHist.draw(ctx);
        this.harvestedGspHist.draw(ctx);
        this.harvestedWeightHist.draw(ctx);
        this.harvestedRootHist.draw(ctx);
        this.harvestedSeedHist.draw(ctx);
        this.harvestedDispersalHist.draw(ctx);
        ctx.restore();
    }

    // A shared key drawn once in the empty band below the population graph: the heat-map colour scale plus a
    // short note on what the axes mean. The plots sit flush against the simulation, so a single key here reads
    // better than repeating axis labels on ~30 touching tiles.
    drawKey(ctx) {
        ctx.save();
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";
        var kx = 825, ky = 190;
        ctx.fillText("Heat-map colour = share of the population at each value:", kx, ky);
        // colour ramp, using the same mapping as Histogram.fill (log-scaled blues)
        var rampW = 160, rampH = 12, ry = ky + 8;
        for (var i = 0; i < rampW; i++) {
            var c = (i / (rampW - 1)) * 99 + 1;
            c = 511 - Math.floor(Math.log(c) / Math.log(100) * 512);
            if (c > 255) { c = c - 256; ctx.fillStyle = rgb(c, c, 255); }
            else { ctx.fillStyle = rgb(0, 0, c); }
            ctx.fillRect(kx + i, ry, 1, rampH);
        }
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 1; ctx.strokeRect(kx, ry, rampW, rampH);
        ctx.fillStyle = "#000000";
        ctx.fillText("low", kx, ry + rampH + 13);
        ctx.textAlign = "right"; ctx.fillText("high", kx + rampW, ry + rampH + 13);
        ctx.textAlign = "left";
        var ty = ry + rampH + 34;
        ctx.fillText("Each heat map: vertical = trait value (low at bottom, high at top),  horizontal = time (older at left, now at right).", kx, ty);
        ctx.fillText("Lineage-age plots are counted in generations since the lineage was last planted.", kx, ty + 17);
        ctx.restore();
    }
}