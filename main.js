var gameEngine = new GameEngine();

var ASSET_MANAGER = new AssetManager();

function reset() {
    loadParameters();
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
