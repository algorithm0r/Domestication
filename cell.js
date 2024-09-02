
class Cell {
    constructor(game, x, y) {
        this.x = x;
        this.y = y;
        this.game = game;

        this.water = params.dry;
        this.seeds = [];
        this.dormantSeeds = [];
        this.humans = [];

        this.color = "brown";
    }
    init(board) {
        this.board = board;

        this.north = this.y > 0 ? this.board[this.x][this.y - 1] : null;
        this.east = this.x < params.dimension - 1 ? this.board[this.x + 1][this.y] : null;
        this.south = this.y < params.dimension - 1 ? this.board[this.x][this.y + 1] : null;
        this.west = this.x > 0 ? this.board[this.x - 1][this.y] : null;

        this.northwest = this.north ? this.north.west : null;
        this.northeast = this.north ? this.north.east : null;
        this.southwest = this.west ? this.west.south : null;
        this.southeast = this.x < params.dimension - 1 && this.y < params.dimension - 1 ? this.board[this.x + 1][this.y + 1] : null;
    }
    flood() {
        if (this.water !== params.dry || (this.east && this.east.water != params.dry) || (this.west && this.west.water === params.dry + 2))
            this.water++;
    }
    drought() {
        this.water--;
        if (this.water < params.dry) this.water = params.dry;
    }
    decayDormantSeeds() {
        let chance = 0.5;
        this.dormantSeeds = this.dormantSeeds.filter(seed => Math.random() > chance);
    }
    germinate() {
        // add new seeds by priority    
        while (this.seeds.length < 4 && this.dormantSeeds.length > 0) {
            const randomSeed = this.dormantSeeds[Math.floor(randomInt(this.dormantSeeds.length))];
            this.seeds.push(randomSeed.seed);
            this.game.board.seeds.push(randomSeed.seed);
            // this.dormantSeeds.splice(this.dormantSeeds.indexOf(randomSeed), 1);
        }
    }
    addSeed(seed, offset) {
        if (!this.shelter) {
            var s = new Seed(seed);
            s.cell = this;
            s.x = this.x;
            s.y = this.y;

            let l = randomInt(4) + offset;
            let p = 0;

            this.dormantSeeds.push({ seed: s, level: l, priority: p });
        }
    }
    removeSeed(seed) {
        for (var i = 0; i < this.seeds.length; i++) {
            if (this.seeds[i] === seed) {
                this.seeds.splice(i, 1);
                return;
            }
        }
    }
    addHuman(human) {
        this.humans.push(human);
        human.cell = this;
        human.x = this.x;
        human.y = this.y;
    }
    removeHuman(human) {
        for (var i = 0; i < this.humans.length; i++) {
            if (this.humans[i] === human) {
                this.humans.splice(i, 1);
                return;
            }
        }
    }
    update() {
        // if (this.water > params.riverWidth) this.seeds = []; // drown seeds in flood time
        this.germinate();
        this.decayDormantSeeds();
    }
    draw(ctx) {
        if (this.water <= 0) {
            var h = 18;
            var s = 30 - this.water * 2;
            var l = 30 - this.water * 4;
            this.color = hsl(h, s, l);
        }
        else {
            var r = 0;
            var g = 0;
            var b = 255 - this.water * 10;
            this.color = rgb(r, g, b);
        }
        if (this.shelter) this.color = "gray";
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x * params.size, this.y * params.size, params.size, params.size);
        for (var i = 0; i < this.seeds.length; i++) {
            this.seeds[i].draw(ctx, i);
        }
        for (var i = 0; i < this.humans.length; i++) {
            this.humans[i].draw(ctx);
        }
    }
};












