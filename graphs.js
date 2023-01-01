var socket = io.connect("http://73.225.31.4:8888");
var context;
var ticks = 199;
var maxRuns = 100;
var height = 200;
var xDelta = 4;
var width = xDelta * ticks;
var obj;

socket.on("connect", function () {
    console.log("connected on output");
});

document.addEventListener("DOMContentLoaded", function (event) {
    context = document.getElementById("chart").getContext("2d");
    socket.emit("find", { db: "test", collection: "domestication", query: {"params.seedStrategy": "none", "params.plantStrategy": "none" }});

    document.getElementById("query").addEventListener("click", function (e) {
        var query = document.getElementById("seed_selection").value;
        var drop = document.getElementById("plant_selection").value;
        socket.emit("find", { db: "test", collection: "domestication", query: {"params.seedStrategy": query, "params.plantStrategy": drop }});
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
            download("seeds" + obj.params.seedStrategy + ".txt", serialize(obj.histogramSeeds));
            download("roots" + obj.params.seedStrategy + ".txt", serialize(obj.histogramRoots));
            download("weight" + obj.params.seedStrategy + ".txt", serialize(obj.histogramWeight));
            download("disp" + obj.params.seedStrategy + ".txt", serialize(obj.histogramDisp));
            download("energy" + obj.params.seedStrategy + ".txt", serialize(obj.histogramEnergy));
        }
    }, false);
});

socket.on("find", function (e) {
//    var array = e.slice(0, 200);
    var array = e;
    if (array.length > 0) parseData(array);
    else console.log("Empty data.");
});

function serialize(hist) {
    var str = "";
    for (var i = 0; i < ticks; i++) {
        str += hist[i] + "\n";
    }
    return str;
};

function parseData(data) {

    var arrHumans = [];
    var arrSeed = [];
    var totalSeeds = [];

    for (var i = 0; i < ticks; i++) {
        arrHumans.push(0);
        arrSeed.push(0);
        totalSeeds.push(0);
    }

    var maxHuman = 0;
    var maxSeed = 0;
    var runs = Math.min(maxRuns, data.length);
    for (var i = 0; i < runs; i++) {
        for (var j = 0; j < data[i].humanPop.length; j++) {
            arrHumans[j] += data[i].humanPop[j] / data.length;
            totalSeeds[j] += data[i].seedPop[j];
            arrSeed[j] += data[i].seedPop[j] / data.length;
        }
    }

    for (var i = 0; i < arrHumans.length; i++) {
        if (arrHumans[i] > maxHuman) {
            maxHuman = arrHumans[i];
        }
        if (arrSeed[i] > maxSeed) {
            maxSeed = arrSeed[i];
        }
    }

    var histogramRoots = [];
    var histogramWeight = [];
    var histogramSeeds = [];
    var histogramEnergy = [];
    var histogramDisp = [];

    for (var i = 0; i < ticks; i++) {
        histogramRoots.push([]);
        histogramWeight.push([]);
        histogramSeeds.push([]);
        histogramEnergy.push([]);
        histogramDisp.push([]);
        for (var j = 0; j < 20; j++) {
            histogramRoots[i].push(0);
            histogramWeight[i].push(0);
            histogramSeeds[i].push(0);
            histogramEnergy[i].push(0);
            histogramDisp[i].push(0);
        }
    }

    for (var j = 0; j < ticks; j++) {
        for (var k = 0; k < 20; k++) {
            for (var i = 0; i < runs; i++) {
                histogramRoots[j][k] += data[i].rootData[j][k] / totalSeeds[j];
                histogramWeight[j][k] += data[i].weightData[j][k] / totalSeeds[j];
                histogramSeeds[j][k] += data[i].seedData[j][k] / totalSeeds[j];
                histogramEnergy[j][k] += data[i].energyData[j][k] / totalSeeds[j];
                histogramDisp[j][k] += data[i].dispersalData[j][k] / totalSeeds[j];
            }
        }
    }

    //for (var j = 0; j < ticks; j++) {
    //    var testsum = 0;
    //    for (var k = 0; k < 20; k++) {
    //        testsum += histogramRoots[j][k];
    //    }
    //    console.log(testsum);
    //}
    obj = {
        params: data[0].params,
        runs: data.length,
        query: data[0].params.seedStrategy,
        humans: arrHumans,
        seeds: arrSeed,
        maxHuman: maxHuman,
        maxSeed: maxSeed,
        histogramRoots: histogramRoots,
        histogramWeight: histogramWeight,
        histogramSeeds: histogramSeeds,
        histogramEnergy: histogramEnergy,
        histogramDisp: histogramDisp,
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
    ctx.fillRect(0, 220, width, height);
    ctx.fillRect(0, 440, width, height);
    ctx.fillRect(0, 660, width, height);
    ctx.fillRect(880, 220, width, height);
    ctx.fillRect(880, 440, width, height);

    drawGraph(ctx, "Black", 0, obj.humans, maxHuman, false);
    drawGraph(ctx, "Green", 0, obj.seeds, maxSeed, true);
    drawHistogram(ctx, 0, 220, obj.histogramRoots, "Deep Roots");
    drawHistogram(ctx, 220, 220, obj.histogramWeight, "Seed Weight");
    drawHistogram(ctx, 0, 440, obj.histogramSeeds, "Fecundity");
    drawHistogram(ctx, 220, 440, obj.histogramEnergy, "Fruit Energy");
    drawHistogram(ctx, 0, 660, obj.histogramDisp, "Dispersal");
    
    ctx.strokeStyle = "black";
    ctx.strokeRect(0, 0, width, height);
    ctx.strokeRect(0, 220, width, height);
    ctx.strokeRect(0, 440, width, height);
    ctx.strokeRect(0, 660, width, height);
    ctx.strokeRect(880, 220, width, height);
    ctx.strokeRect(880, 440, width, height);

    ctx.font = "20px Arial";
    ctx.fillText("Runs: " + runs, 30, 950);
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
    for (var i = 0; i < ticks; i++) {
        for (var j = 0; j < 20; j++) {
            fill(ctx, obj[i][j], yStart, xStart + i, 19 - j);
        }
    }
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