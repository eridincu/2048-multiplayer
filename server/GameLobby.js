'use strict';

/*
	GameLobby constructs a new game lobby
	id - uuid of game loby
	player1 -  a SockJS connection instance of a player
	player2 - a connection instance of a player
*/
function GameLobby(id, player1, player2, startCells, size, cleanup) {
	this.id = id;
	this.player1 = player1;
	this.player2 = player2;
	this.startCells = startCells;
	this.size = size;
	this.cleanup = cleanup;

	this.setup(player1, 1);
	this.setup(player2, 2);
}

GameLobby.prototype.setup = function (player, playerNum) {
  var self = this;

  player.write(JSON.stringify({
    player: playerNum,
    startCells: this.startCells,
    size: this.size,
    start: true
  }));

  player.on('data', function (data) {
    self.emit(data);
  });

  player.on('close', function () {
    self.emit(JSON.stringify({ player: 0, dead: true, gameEnd: true }));
  });
};

GameLobby.prototype.emit = function (msg) {
	this.player1.write(msg);
	this.player2.write(msg);

  msg = JSON.parse(msg);

	if (msg.gameEnd)
		this.cleanup(this.id);
};

module.exports = GameLobby;
