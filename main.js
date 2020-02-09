var gameEngine = new GameEngine();

var ASSET_MANAGER = new AssetManager();

var socket = null;
if (window.io !== undefined) {
    console.log("Database connected!");
    socket = io.connect('http://24.16.255.56:8888');
}

function reset() {
    gameEngine.entities = [];
    var automata = new Automata(gameEngine);
    gameEngine.addEntity(automata);
};

ASSET_MANAGER.downloadAll(function () {
	console.log("starting up da sheild");
	var canvas = document.getElementById('gameWorld');
	var ctx = canvas.getContext('2d');

	gameEngine.init(ctx);

	reset();

	gameEngine.start();
});
