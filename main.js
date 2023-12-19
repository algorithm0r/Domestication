var gameEngine = new GameEngine();

var ASSET_MANAGER = new AssetManager();

var socket = null;
if (window.io !== undefined) {
	console.log("Database connected!");

	socket = io.connect('http://73.225.31.4:8888');

	socket.on("connect", function () {
		databaseConnected();
	});
	
	socket.on("disconnect", function () {
		databaseDisconnected();
	});

	socket.addEventListener("log", console.log);
}

function reset() {
	if (gameEngine.board) {
		gameEngine.board.reset();
	} else {
		gameEngine.entities = [];
		new Automata(gameEngine);
	}
};

ASSET_MANAGER.downloadAll(function () {
	console.log("starting up da sheild");
	var canvas = document.getElementById('gameWorld');
	var ctx = canvas.getContext('2d');

	gameEngine.init(ctx);

	reset();

	gameEngine.start();
});
