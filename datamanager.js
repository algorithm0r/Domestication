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

            if (seeds[k].dispersal.value < params.wildDomesticThreshold) {
                domeSeedPop++;
                weightDataDomesticated[weightIndex]++;
                rootsDataDomesticated[rootsIndex]++;
                seedDataDomesticated[seedIndex]++;
                dispersalDataDomesticated[dispersalIndex]++;
            }
            else {
                wildSeedPop++;
                weightDataWild[weightIndex]++;
                rootsDataWild[rootsIndex]++;
                seedDataWild[seedIndex]++;
                dispersalDataWild[dispersalIndex]++;
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
    }
}