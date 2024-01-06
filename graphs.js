var socket = io.connect("http://73.225.31.4:8888");
var context;
var ticks = 600;
var maxRuns = 100;
var height = 40;
var xDelta = 1;
var width = xDelta * ticks;
var numRecords = 0;
var page = 0;
var data = [];
var limit = 20;

var query;
var obj;

socket.on("connect", function () {
    databaseConnected();
});

socket.on("disconnect", function () {
    databaseDisconnected();
});

document.addEventListener("DOMContentLoaded", function (event) {
    context = document.getElementById("chart").getContext("2d");
    // socket.emit("find", 
    //     { 
    //         db: params.db, 
    //         collection: params.collection, 
    //         query: {"params.seedStrategy": "none", "params.plantStrategy": "none" },
    //         limit: 10
    //     });

    console.log("DOM loaded.");

    socket.emit("distinct",
        {
            db: params.db,
            collection: params.collection,
            key: "params.runName"
        });

    document.getElementById("query").addEventListener("click", function (e) {
        query = document.getElementById("run_selection").value;
        document.getElementById("query_info").innerHTML = "Query Sent. Awaiting Reply.";
        console.log(query);

   
        socket.emit("count",
        {
            db: params.db,
            collection: params.collection,
            query: { "params.runName": query },
        });

        
        
        // socket.emit("find",
        //     {
        //         db: params.db,
        //         collection: params.collection,
        //         query: { "params.runName": query },
        //         limit: 20,
        //         page: 1
        //     });
    }, false);

    // document.getElementById("next").addEventListener("click", function (e) {
    //     var q = document.getElementById("runToQuery");

    //     var query = parseInt(q.value);
    //     q.value = ++query%16;
    //     var drop = parseFloat(document.getElementById("drop").value);
    //     socket.emit("loadDom", { run: "testing", "params.seedStrategy": query, "params.seedDropRate": drop });
    // }, false);

    document.getElementById("download").addEventListener("click", function (e) {
        console.log("Download clicked.");
        console.log(obj);
        if (obj.params) {
            download("seeds" + obj.params.seedStrategy + obj.params.plantStrategy + ".txt", serialize(obj.histogramSeeds));
            download("roots" + obj.params.seedStrategy + obj.params.plantStrategy + ".txt", serialize(obj.histogramRoots));
            download("weight" + obj.params.seedStrategy + obj.params.plantStrategy + ".txt", serialize(obj.histogramWeight));
            download("disp" + obj.params.seedStrategy + obj.params.plantStrategy + ".txt", serialize(obj.histogramDisp));
            download("energy" + obj.params.seedStrategy + obj.params.plantStrategy + ".txt", serialize(obj.histogramEnergy));
        }
    }, false);
    document.getElementById("downloadwild").addEventListener("click", function (e) {
        console.log("Download clicked.");
        console.log(obj);
        if (obj.params) {
            download("seeds" + obj.params.seedStrategy + obj.params.plantStrategy + "wild.txt", serialize(obj.histogramSeedsWild));
            download("roots" + obj.params.seedStrategy + obj.params.plantStrategy + "wild.txt", serialize(obj.histogramRootsWild));
            download("weight" + obj.params.seedStrategy + obj.params.plantStrategy + "wild.txt", serialize(obj.histogramWeightWild));
            download("disp" + obj.params.seedStrategy + obj.params.plantStrategy + "wild.txt", serialize(obj.histogramDispWild));
            download("energy" + obj.params.seedStrategy + obj.params.plantStrategy + "wild.txt", serialize(obj.histogramEnergyWild));
        }
    }, false);
    document.getElementById("downloaddome").addEventListener("click", function (e) {
        console.log("Download clicked.");
        console.log(obj);
        if (obj.params) {
            download("seeds" + obj.params.seedStrategy + obj.params.plantStrategy + "dome.txt", serialize(obj.histogramSeedsDomesticated));
            download("roots" + obj.params.seedStrategy + obj.params.plantStrategy + "dome.txt", serialize(obj.histogramRootsDomesticated));
            download("weight" + obj.params.seedStrategy + obj.params.plantStrategy + "dome.txt", serialize(obj.histogramWeightDomesticated));
            download("disp" + obj.params.seedStrategy + obj.params.plantStrategy + "dome.txt", serialize(obj.histogramDispDomesticated));
            download("energy" + obj.params.seedStrategy + obj.params.plantStrategy + "dome.txt", serialize(obj.histogramEnergyDomesticated));
        }
    }, false);
});

socket.on("count", function (length) {
    numRecords = length;
    document.getElementById("query_info").innerHTML = `Received 0 of ${numRecords} records.`;
    page = 0;
    data = [];
    // for (var i = 0; i < length/limit; i++) {
        socket.emit("find",
            {
                db: params.db,
                collection: params.collection,
                query: { "params.runName": query },
                limit: limit,
                page: page
            });
        console.log(`Requesting page ${page} of size ${limit}.`);
    // }
});

socket.on("find", function (array) {
    if (array.length > 0) {
        console.log("Find: data received.")

        data.push(...array);
        document.getElementById("query_info").innerHTML = `Received ${data.length} of ${numRecords} records.`;

        if(data.length === numRecords) parseData(data);
        else {
            socket.emit("find",
            {
                db: params.db,
                collection: params.collection,
                query: { "params.runName": query },
                limit: limit,
                page: ++page
            });
            console.log(`Requesting page ${page} of size ${limit}.`);
        }
    }
    else console.log("Empty data.");
});

socket.on("distinct", function (array) {
    document.getElementById("query_info").innerHTML = "Ready to Query";
    console.log(array);
    console.log("\n");
    
    if (array.length > 0) populateDropDown(array);
    else console.log("Empty data.");
});

function populateDropDown(labels) {
    const runSelect = document.getElementById("run_selection");

    // Populate the dropdown with names
    labels.forEach((label) => {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        runSelect.appendChild(option);
    });
}

function serialize(hist) {
    var str = "";
    for (var i = 0; i < ticks; i++) {
        str += hist[i] + "\n";
    }
    return str;
};

function combineHistograms(data, totalSeeds, identifier) {
    var histogram = [];

    for (var i = 0; i < ticks; i++) {
        histogram.push([]);
        for (var j = 0; j < 20; j++) {
            histogram[i].push(0);
        }
    }

    for (var j = 0; j < ticks; j++) {
        for (var k = 0; k < 20; k++) {
            for (var i = 0; i < data.length; i++) {
                histogram[j][k] += data[i][identifier][j][k] / totalSeeds[j];
            }
        }
    }
    return histogram;
};



function parseData(data) {

    var avgHumanPop = [];
    var avgSeedPop = [];
    var avgDomePop = [];
    var avgWildPop = [];
    var totalSeeds = [];

    for (var i = 0; i < ticks; i++) {
        avgHumanPop.push(0);
        avgSeedPop.push(0);
        avgDomePop.push(0);
        avgWildPop.push(0);
        totalSeeds.push(0);
    }

    var maxHuman = 0;
    var maxSeed = 0;
    var runs = Math.min(maxRuns, data.length);
    for (var i = 0; i < runs; i++) {
        for (var j = 0; j < data[i].humanPop.length; j++) {
            avgHumanPop[j] += data[i].humanPop[j] / data.length;
            totalSeeds[j] += data[i].seedPop[j];
            avgSeedPop[j] += data[i].seedPop[j] / data.length;
            avgDomePop[j] += data[i].domePop[j] / data.length;
            avgWildPop[j] += data[i].wildPop[j] / data.length;
        }
    }

    for (var i = 0; i < avgHumanPop.length; i++) {
        if (avgHumanPop[i] > maxHuman) {
            maxHuman = avgHumanPop[i];
        }
        if (avgSeedPop[i] > maxSeed) {
            maxSeed = avgSeedPop[i];
        }
    }

    var histogramRoots = combineHistograms(data,totalSeeds,"rootData");
    var histogramWeight = combineHistograms(data,totalSeeds,"weightData");
    var histogramSeeds = combineHistograms(data,totalSeeds,"seedData");
    var histogramEnergy = combineHistograms(data,totalSeeds,"energyData");
    var histogramDisp = combineHistograms(data,totalSeeds,"dispersalData");

    var histogramRootsWild = combineHistograms(data,totalSeeds,"rootDataWild");
    var histogramWeightWild = combineHistograms(data,totalSeeds,"weightDataWild");
    var histogramSeedsWild = combineHistograms(data,totalSeeds,"seedDataWild");
    var histogramEnergyWild = combineHistograms(data,totalSeeds,"energyDataWild");
    var histogramDispWild = combineHistograms(data,totalSeeds,"dispersalDataWild");

    var histogramRootsDomesticated = combineHistograms(data,totalSeeds,"rootDataDomesticated");
    var histogramWeightDomesticated = combineHistograms(data,totalSeeds,"weightDataDomesticated");
    var histogramSeedsDomesticated = combineHistograms(data,totalSeeds,"seedDataDomesticated");
    var histogramEnergyDomesticated = combineHistograms(data,totalSeeds,"energyDataDomesticated");
    var histogramDispDomesticated = combineHistograms(data,totalSeeds,"dispersalDataDomesticated");


    //for (var j = 0; j < ticks; j++) {
    //    var testsum = 0;
    //    for (var k = 0; k < 20; k++) {
    //        testsum += histogramRoots[j][k];
    //    }
    //    console.log(testsum);
    //}
    obj = {
        runName: data[0].params.runName ?? "no runName",
        params: data[0].params,
        runs: data.length,
        query: data[0].params.seedStrategy,
        humans: avgHumanPop,
        seeds: avgSeedPop,
        wild: avgWildPop,
        dome: avgDomePop,
        maxHuman: maxHuman,
        maxSeed: maxSeed,
        histogramRoots: histogramRoots,
        histogramWeight: histogramWeight,
        histogramSeeds: histogramSeeds,
        histogramEnergy: histogramEnergy,
        histogramDisp: histogramDisp,
        histogramRootsWild: histogramRootsWild,
        histogramWeightWild: histogramWeightWild,
        histogramSeedsWild: histogramSeedsWild,
        histogramEnergyWild: histogramEnergyWild,
        histogramDispWild: histogramDispWild,
        histogramRootsDomesticated: histogramRootsDomesticated,
        histogramWeightDomesticated: histogramWeightDomesticated,
        histogramSeedsDomesticated: histogramSeedsDomesticated,
        histogramEnergyDomesticated: histogramEnergyDomesticated,
        histogramDispDomesticated: histogramDispDomesticated,
    };

    //console.log(obj);
    //console.log(data);
    drawData(runs, context);
    labelRun(data[0].params.seedStrategy);
    //var str = formatRole(obj);
    //download(document.getElementById("runToQuery").value, str);
    //str = formatForage(obj);
    //download(document.getElementById("runToQuery").value + "-f", str);
}

function labelRun(run) {
    var str = "";
    switch (run) {
        case 0:
            str = "Random Seed";
            break;
        case 1:
            str = "Most Seeds";
            break;
        case 2:
            str = "Fewest Seeds";
            break;
        case 3:
            str = "Min Penalty";
            break;
        case 4:
            str = "Max Penalty";
            break;
        case 5:
            str = "Min Roots";
            break;
        case 6:
            str = "Max Roots";
            break;
        case 7:
            str = "Min Seed Weight";
            break;
        case 8:
            str = "Max Seed Weight";
            break;
        case 9:
            str = "Min Dispersal";
            break;
        case 10:
            str = "Max Dispersal";
            break;
        case 11:
            str = "Min Fruit Energy";
            break;
        case 12:
            str = "Max Fruit Energy";
            break;
        case 13:
            str = "Min Energy";
            break;
        case 14:
            str = "Max Energy";
            break;
        case 15:
            str = "No Humans";
            break;
    }
    context.fillText(str, 15, 755);
}

function drawData(runs, ctx) {
    ctx.font = "10px Arial";
    ctx.clearRect(0, 0, 2400, 1000);
    ctx.textAlign = "start";
    var maxHuman = obj.maxHuman * 1.05;
    var maxSeed = obj.maxSeed * 1.05;

    ctx.fillStyle = "#eeeeee";
    ctx.fillRect(0, 0, width, height);

    drawGraph(ctx, "Black", 0, obj.humans, maxHuman, false);
    drawGraph(ctx, "Green", 0, obj.seeds, maxSeed, true);
    drawGraph(ctx, "Blue", 0, obj.dome, maxSeed, true);
    drawGraph(ctx, "Red", 0, obj.wild, maxSeed, true);

    histograms = [];
    labels = [];

    histograms.push(obj.histogramRoots);
    labels.push("Deep Roots");
    histograms.push(obj.histogramWeight);
    labels.push("Seed Weight");
    histograms.push(obj.histogramSeeds);
    labels.push("Fecundity");
    histograms.push(obj.histogramEnergy);
    labels.push("Fruit Energy");
    histograms.push(obj.histogramDisp);
    labels.push("Dispersal");

    histograms.push(obj.histogramRootsWild);
    labels.push("Deep Roots - Wild");
    histograms.push(obj.histogramWeightWild);
    labels.push("Seed Weight - Wild");
    histograms.push(obj.histogramSeedsWild);
    labels.push("Fecundity - Wild");
    histograms.push(obj.histogramEnergyWild);
    labels.push("Fruit Energy - Wild");
    histograms.push(obj.histogramDispWild);
    labels.push("Dispersal - Wild");

    histograms.push(obj.histogramRootsDomesticated);
    labels.push("Deep Roots - Domesticated");
    histograms.push(obj.histogramWeightDomesticated);
    labels.push("Seed Weight - Domesticated");
    histograms.push(obj.histogramSeedsDomesticated);
    labels.push("Fecundity - Domesticated");
    histograms.push(obj.histogramEnergyDomesticated);
    labels.push("Fruit Energy - Domesticated");
    histograms.push(obj.histogramDispDomesticated);
    labels.push("Dispersal - Domesticated");

    for(var i = 0; i < histograms.length; i++){
        drawHistogram(ctx, 0, 55 + 55*i, histograms[i], labels[i]);
    }   

    ctx.strokeStyle = "black";
    ctx.strokeRect(0, 0, width, height);

    ctx.font = "20px Arial";
    ctx.fillText(obj.runName, 10, 900);
    ctx.fillText("Runs: " + runs, 10, 950);
}

function drawGraph(ctx, color, start, obj, maxVal, labeling) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    var initAnt = height + start - Math.floor(obj[0] / maxVal * height);
    ctx.moveTo(0, initAnt);
    for (var i = 0; i < ticks; i ++) {
        var yPos = height + start - Math.floor(obj[i] / maxVal * height);
        ctx.lineTo(i*xDelta, yPos);
    }
    ctx.stroke();
    ctx.closePath();

    if (labeling) {
        ctx.fillStyle = "#000000";
        ctx.fillText(Math.ceil(maxVal), width + 4, start + 10);
        ctx.fillText(10000, width / 2 - 15, start + height + 10);
        ctx.fillText(20000, width - 15, start + height + 10);
    }
}

function drawHistogram(ctx, xStart, yStart, obj, label) {
    ctx.fillRect(xStart*xDelta, yStart, width, height);
    ctx.fillStyle = "#eeeeee";
    for (var i = 0; i < ticks; i++) {
        for (var j = 0; j < 20; j++) {
            fill(ctx, obj[i][j], yStart, xStart + i, 19 - j);
        }
    }

    ctx.strokeStyle = "black";
    ctx.strokeRect(xStart*xDelta, yStart, width, height);

    ctx.fillStyle = "Black";
    ctx.fillText(label, xStart*xDelta + width / 2 - 30, yStart + height + 10);
}

function fill(ctx, color, start, x, y) {
    var base = 16;
    var c = color * (base - 1) + 1;
    c = 511 - Math.floor(Math.log(c) / Math.log(base) * 512);
    if (c > 255) {
        c = c - 256;
        ctx.fillStyle = rgb(c, c, 255);
    }
    else {
        //c = 255 - c;
        ctx.fillStyle = rgb(0, 0, c);
    }

    ctx.fillRect(x * xDelta,
		            start + (y * height / 20),
				    xDelta,
					height / 20);

}