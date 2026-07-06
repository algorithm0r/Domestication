
class Cell {
    constructor(game, x, y) {
        this.x = x;
        this.y = y;
        this.game = game;

        this.water = params.dry;
        this.seeds = [];
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
    addSeed(seed, offset, planted) {
        // Reverted the dormant seed-bank: a fallen/sown seed takes root immediately if the cell has
        // room, otherwise it dies on the spot. The old dormancy (a queue drained by germinate() with
        // a per-tick 50% decay) was behaviorally this same "root-if-space-else-die" with many extra
        // steps and a whole per-cell update pass, for negligible effect. `offset` is now unused (it
        // only ever fed the dead `level` field); kept in the signature so callers need not change.
        if (this.shelter) return;                               // shelters don't grow seeds
        if (this.seeds.length >= params.cellCapacity) return;   // no room -> seed dies immediately
        var s = new Seed(seed);
        s.cell = this;
        s.x = this.x;
        s.y = this.y;
        s.planted = !!planted;   // true only when a human sows it (cultivate); natural fall / world-init -> false
        if (planted) s.gsp = 0;  // sowing resets the generations-since-planted counter
        this.seeds.push(s);
        this.game.board.seeds.push(s);
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












