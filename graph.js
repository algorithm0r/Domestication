class Graph {
    constructor(game, x, y, data, label) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.data = data;
        this.label = label;

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

                this.ctx.strokeStyle = "#000000";
                this.ctx.fillSytle = "#000000";
                this.ctx.fillText(data[data.length - 1], this.x + this.xSize + 5, yPos + 10);

            }
        }
        var firstTick = 0;
        firstTick = this.data[0].length > this.xSize ? this.data[0].length - this.xSize : 0;
        this.ctx.fillText(firstTick * params.reportingPeriod, this.x, this.y + this.ySize + 10);
        this.ctx.textAlign = "right";
        this.ctx.fillText(this.data[0].length - 1, this.x + this.xSize - 5, this.y + this.ySize + 10);

        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);
    }
    updateMax() {
        this.maxVal = Math.max(...[].concat(...this.data));
    }
}



