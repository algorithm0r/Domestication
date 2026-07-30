class Graph {
    constructor(game, x, y, data, label, labels) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.data = data;
        this.label = label;
        this.labels = labels || [];   // series names, drawn as a legend

        this.xSize = 600;
        this.ySize = 135;
        this.ctx = game.ctx;
        this.colors = ["#00BB00", "#BB0000", "#00BBBB", "#CCCCCC"];
        this.maxVal = 0;
    }
    update() {
    }
    draw(ctx) {
        this.updateMax();
        this.ctx.font = "14px Arial";
        // if (!document.getElementById("graphs").checked) return;
        if (this.data[0].length > 1) {
            for (var j = 0; j < this.data.length; j++) {
                var data = this.data[j];

                this.ctx.strokeStyle = this.colors[j];
                this.ctx.lineWidth = 2;

                this.ctx.beginPath();
                var xPos = this.x;
                var yPos = data.length > this.xSize ? this.y + this.ySize - Math.floor(data[data.length - this.xSize] / this.maxVal * this.ySize)
                    : this.y + this.ySize - Math.floor(data[0] / this.maxVal * this.ySize);
                this.ctx.moveTo(xPos, yPos);
                var length = data.length > this.xSize ?
                    this.xSize : data.length;
                for (var i = 1; i < length; i++) {
                    var index = data.length > this.xSize ?
                        data.length - this.xSize - 1 + i : i;
                    xPos++;
                    yPos = this.y + this.ySize - Math.floor(data[index] / this.maxVal * this.ySize);
                    if (yPos <= 0) {
                        yPos = 0;
                    }

                    this.ctx.lineTo(xPos, yPos);
                }
                this.ctx.stroke();
                this.ctx.closePath();
            }
        }
        var firstTick = 0;
        firstTick = this.data[0].length > this.xSize ? this.data[0].length - this.xSize : 0;
        this.ctx.fillStyle = "#000000";
        this.ctx.textAlign = "left";
        this.ctx.fillText(firstTick * params.reportingPeriod, this.x, this.y + this.ySize + 14);
        this.ctx.textAlign = "right";
        this.ctx.fillText(this.data[0].length - 1, this.x + this.xSize - 5, this.y + this.ySize + 14);

        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);

        // axis titles (in the empty space below and to the right of the plot) and a series legend
        this.ctx.fillStyle = "#000000";
        this.ctx.textAlign = "center";
        this.ctx.fillText("time step", this.x + this.xSize / 2, this.y + this.ySize + 28);
        this.ctx.textAlign = "left";
        var lx = this.x + this.xSize + 48;
        this.ctx.fillText(this.label + " (peak " + Math.round(this.maxVal) + ")", lx, this.y + 14);
        for (var k = 0; k < this.labels.length; k++) {
            var ly = this.y + 30 + k * 16;
            this.ctx.strokeStyle = this.colors[k];
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(lx, ly);
            this.ctx.lineTo(lx + 18, ly);
            this.ctx.stroke();
            this.ctx.fillStyle = "#000000";
            var cur = (this.data[k] && this.data[k].length) ? Math.round(this.data[k][this.data[k].length - 1]) : 0;
            this.ctx.fillText(this.labels[k] + ": " + cur, lx + 24, ly + 4);
        }
    }
    updateMax() {
        this.maxVal = Math.max(...[].concat(...this.data));
    }
}



