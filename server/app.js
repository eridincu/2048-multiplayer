'use strict';

var http = require('http'),
    url = require('url'),
    winston = require('winston'),
    uuid = require('node-uuid'),
    sockjs = require('sockjs'),
    GameLobby = require('./GameLobby'),
    redis = require("redis"),
    client = redis.createClient(),
    gamersHashMap = {},
    gamesBeingPlayed = 0,
    playersPublicHashMap = {},
    playersReversePublicHashMap = {},
    players = 0,
    waiters = 0,
    channelHashMap = {},
    channelId;

var CROSS_ORIGIN_HEADERS = {
  'Content-Type': 'text/plain',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-Requested-With'
};

var sockjsServer = sockjs.createServer();
sockjsServer.setMaxListeners(0);
var GRID_SIZE = 4;

var cleanup = function (channelId) {
	if (channelHashMap[channelId]) {
		winston.info('===Game #' + channelId + ' Cleanup===');
		delete channelHashMap[channelId];
		gamesBeingPlayed--;
    showStats();
	}
};

sockjsServer.on('connection', function (io) {
  client.lpush('players', io.id);
  players++;

  winston.info('New player joined');
	showStats();

  io.on('data', function (data) {
  	data = JSON.parse(data);

  	if (!data.event)
  		return;

  	switch (data.event) {
  		case 'register':
        playersPublicHashMap[data.hash.toLowerCase()] = io;
  			playersReversePublicHashMap[io.id] = data.hash;
  			winston.info('New room registered: ' + data.hash);
  			break;
  		case 'find-opponent':
  			client.lpush('waiters', io.id);
  			waiters++;
        findRandomOpponent();
				winston.info('New waiter is waiting (duh)');
				showStats();
				break;
			case 'play-friend':
        if (!data.hash || !data.hash.length)
          return;

				if (!playersPublicHashMap[data.hash.toLowerCase()]) {
					winston.info('Player ' + data.hash.toLowerCase() + ' not found.');
					return;
				}

				winston.info('o/ found your friend, match is starting!');

        playersPublicHashMap[data.hash.toLowerCase()].write(JSON.stringify({
          friendHash: playersReversePublicHashMap[io.id],
          newFriendGame: true
        }));

        startGame(io, playersPublicHashMap[data.hash.toLowerCase()]);
      case 'cleanup':
        break;
			default:
				winston.info('Uncaught event `' + data.event + '` received');
				break;
  	}
  });

  io.on('close', function () {
  	client.lrem('players', 0, io.id, function (err) {
  		if (err) {
				winston.log('err', err);
				return;
  		}

  		winston.info('Removed players from waiting queue');
  		players--;
			showStats();
  	});

  	client.lrem('waiters', 0, io.id, function (err, count) {
  		if (err) {
  			winston.log('err', err);
  			return;
  		}

  		if (count === 0)
  			return;

  		winston.info('Removed waiter from waiting queue');
  		waiters--;
			showStats();
		});
  });

  gamersHashMap[io.id] = io;
});

var startCellLocations = function (numLocations, size) {
  var unique = function (arr, obj) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (arr[i].x === obj.x && arr[i].y === obj.y)
        return false;
    }
    return true;
  };

  var getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  var loc = [];
  for (var i = 0; i < numLocations; i++) {
    var obj = {
    	x: getRandomInt(0, size - 1),
    	y: getRandomInt(0, size - 1),
    	value: (Math.random() < 0.9 ? 2 : 4)
    };

    if (unique(loc, obj))
			loc.push(obj);
    else
			--i;
  }

  return loc;
};

// todo: handle concurency ?
var findRandomOpponent = function () {
  client.llen('waiters', function (err, len) {
    winston.info('find random, with len: ' + len);
    if (err) winston.log('err', err);
    if (len >= 2) {
      client.lpop('waiters', function (err1, player1) {
        if (err1) winston.log('err', err1);
        waiters--;
        client.lpop('waiters', function (err2, player2) {
          if (err2) winston.log('err', err2);
          waiters--;
          startGame(gamersHashMap[player1], gamersHashMap[player2]);
        });
      });
    }
  });
};

var startGame = function (ioPlayer1, ioPlayer2) {
  gamesBeingPlayed++;
  var channelId = uuid.v4();
  channelHashMap[channelId] = new GameLobby(channelId, ioPlayer1, ioPlayer2, startCellLocations(2, GRID_SIZE), GRID_SIZE, cleanup);

  winston.info('=== New Game #' + channelId + ' started ===');
  showStats();
};

var server = http.createServer(function (req, res) {
  if (url.parse(req.url).pathname === '/game/players') {
    res.writeHead(200, CROSS_ORIGIN_HEADERS);
    res.write(JSON.stringify({
    	numPlayers: players,
    	numWaiters: waiters,
    	numGames: gamesBeingPlayed
    }));

    return res.end();
  }

  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('Go away <3');
});

var showStats = function () {
  winston.info('Total players: ' + players + ' | Total waiters: ' + waiters + ' | Total games: ' + gamesBeingPlayed);
};

sockjsServer.installHandlers(server, { prefix: '/game/sockets' });
server.listen(3000);
