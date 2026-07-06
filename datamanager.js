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
        this.popGraph = new Graph(gameEngine, 810, 0, seedData, "Seed Population");
        // const agentData = [this.humanPop];
        // popGraph = new Graph(gameEngine, 810, 150, agentData, "Human Population");
        // gameEngine.addGraph(popGraph);

        this.weightHist = new Histogram(gameEngine, 810, 300, this.weightData, "Dispersal")
        this.rootHist = new Histogram(gameEngine, 810, 400, this.rootData, "Root Depth");
        this.seedHist = new Histogram(gameEngine, 810, 500, this.seedData, "Fecundity");
        this.dispersalHist = new Histogram(gameEngine, 810, 600, this.dispersalData, "Abscision");
        this.weightHistWild = new Histogram(gameEngine, 1010, 300, this.weightDataWild, "Dispersal - Wild")
        this.rootHistWild = new Histogram(gameEngine, 1010, 400, this.rootDataWild, "Root Depth - Wild");
        this.seedHistWild = new Histogram(gameEngine, 1010, 500, this.seedDataWild, "Fecundity - Wild");
        this.dispersalHistWild = new Histogram(gameEngine, 1010, 600, this.dispersalDataWild, "Abscision - Wild");
        this.weightHistDomesticated = new Histogram(gameEngine, 1210, 300, this.weightDataDomesticated, "Dispersal - Domesticated")
        this.rootHistDomesticated = new Histogram(gameEngine, 1210, 400, this.rootsDataDomesticated, "Root Depth - Domesticated");
        this.seedHistDomesticated = new Histogram(gameEngine, 1210, 500, this.seedDataDomesticated, "Fecundity - Domesticated");
        this.dispersalHistDomesticated = new Histogram(gameEngine, 1210, 600, this.dispersalDataDomesticated, "Abscision - Domesticated");

        // gsp (generations-since-planted / lineage) — population all/wild/dome
        this.gspHist = new Histogram(gameEngine, 810, 700, this.gspData, "gsp / lineage");
        this.gspHistWild = new Histogram(gameEngine, 1010, 700, this.gspDataWild, "gsp - Wild");
        this.gspHistDomesticated = new Histogram(gameEngine, 1210, 700, this.gspDataDomesticated, "gsp - Domesticated");
        // PLANTED-seed event distributions (what humans sow), stacked: gsp + 4 genes
        this.plantedGspHist = new Histogram(gameEngine, 1450, 300, this.plantedGspData, "PLANTED gsp");
        this.plantedWeightHist = new Histogram(gameEngine, 1450, 400, this.plantedWeightData, "PLANTED weight");
        this.plantedRootHist = new Histogram(gameEngine, 1450, 500, this.plantedRootData, "PLANTED root");
        this.plantedSeedHist = new Histogram(gameEngine, 1450, 600, this.plantedSeedData, "PLANTED fecundity");
        this.plantedDispersalHist = new Histogram(gameEngine, 1450, 700, this.plantedDispersalData, "PLANTED dispersal");
        // HARVESTED-seed event distributions (what humans pluck / "predation")
        this.harvestedGspHist = new Histogram(gameEngine, 1670, 300, this.harvestedGspData, "HARVESTED gsp");
        this.harvestedWeightHist = new Histogram(gameEngine, 1670, 400, this.harvestedWeightData, "HARVESTED weight");
        this.harvestedRootHist = new Histogram(gameEngine, 1670, 500, this.harvestedRootData, "HARVESTED root");
        this.harvestedSeedHist = new Histogram(gameEngine, 1670, 600, this.harvestedSeedData, "HARVESTED fecundity");
        this.harvestedDispersalHist = new Histogram(gameEngine, 1670, 700, this.harvestedDispersalData, "HARVESTED dispersal");
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
        ctx.clearRect(ctx.canvas.height, 0, ctx.canvas.height, ctx.canvas.height); // clear graphs only
    
        this.popGraph.draw(ctx);
    
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
    }
}