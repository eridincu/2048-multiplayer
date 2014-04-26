'use strict';

/*
	GameLobby constructs a new game lobby
	id - uuid of game loby
	player1 -  a SockJS connection instance of a player
	player2 - a connection instance of a player
*/
function GameLobby(id, player1, player2, startCells, size, cleanup) {
	this.id = id;
  this.players = {
    1: player1,
    2: player2
  };

	this.startCells = startCells;
	this.size = size;
	this.cleanup = cleanup;

	this.setup(1);
	this.setup(2);
}

GameLobby.prototype.setup = function (playerNum) {
  var self = this;

  this.players[playerNum].write(JSON.stringify({
    player: playerNum,
    startCells: this.startCells,
    size: this.size,
    start: true
  }));

  this.players[playerNum].on('data', function (data) {
    self.emit(data);
  });

  this.players[playerNum].on('close', function () {
    self.emit(JSON.stringify({ player: playerNum, dead: true, gameEnd: true }));
    self.cleanup(self.id);
  });
};

GameLobby.prototype.emit = function (msg) {
	this.players[1].write(msg);
	this.players[2].write(msg);

  msg = JSON.parse(msg);

	if (msg.gameEnd)
		this.cleanup(this.id);
};

module.exports = GameLobby;
