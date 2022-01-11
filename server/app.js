'use strict';

let http = require('http')
let url = require('url')
let uuid = require('node-uuid')
let sockjs = require('sockjs')
let GameLobby = require('./GameLobby')
let redis = require('redis');
let client = redis.createClient()
let gamersHashMap = {}
let gamesBeingPlayed = 0
let gameStats = JSON.stringify({ numPlayers: 0, numGames: 0 })
let channelHashMap = {}
let channelId
let startLocations


var CROSS_ORIGIN_HEADERS = {};
CROSS_ORIGIN_HEADERS['Content-Type'] = 'text/plain';
CROSS_ORIGIN_HEADERS['Access-Control-Allow-Origin'] = '*';
CROSS_ORIGIN_HEADERS['Access-Control-Allow-Headers'] = 'X-Requested-With';
var sockjsServer = sockjs.createServer();
sockjsServer.setMaxListeners(0);
var GRID_SIZE = 4;

var cleanup = function (channelId) {
  if (channelHashMap[channelId]) {
    console.info('===Game Cleanup===');
    console.info('channelId:', channelId);
    console.info('channelHashMap[channelId].gamer1.id:', channelHashMap[channelId].gamer1.id);
    console.info('channelHashMap[channelId].gamer2.id:', channelHashMap[channelId].gamer2.id);
    gamersHashMap[channelHashMap[channelId].gamer1.id] = void 0;
    gamersHashMap[channelHashMap[channelId].gamer2.id] = void 0;
    channelHashMap[channelId] = void 0;
    gamesBeingPlayed--;
  }
};

sockjsServer.on('connection', function (socket) {
  client.lPush('gamers', socket.id);
  socket.on('close', function () {
    client.lRem('gamers', 0, socket.id, function (err, count) {
      if (err) console.log('err', err);
      console.info('Removed gamer from waiting queue');
    });
  });
  gamersHashMap[socket.id] = socket;
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
  }

  var loc = [];
  for (var i = 0; i < numLocations; i++) {
    var obj = { x: getRandomInt(0, size - 1), y: getRandomInt(0, size - 1), value: (Math.random() < 0.9 ? 2 : 4) };
    if (unique(loc, obj)) loc.push(obj);
    else --i;
  }
  return loc;
};

setInterval(function () {
  client.lLen('gamers', function (err, len) {
    if (err) console.log('err', err);
    if (len >= 2) {
      client.lPop('gamers', function (err1, gamer1) {
        if (err1) console.log('err', err1);
        client.lPop('gamers', function (err2, gamer2) {
          if (err2) console.log('err', err2);
          console.info('===New Game===');
          console.info('channelId:', channelId);
          console.info('gamer1:', gamer1);
          console.info('gamer2:', gamer2);
          channelId = uuid.v4();
          startLocations = startCellLocations(2, GRID_SIZE);
          gamesBeingPlayed++;
          channelHashMap[channelId] = new GameLobby (channelId, gamersHashMap[gamer1], gamersHashMap[gamer2], startLocations, GRID_SIZE, cleanup);
        });
      });
    }
  })
}, 500);

setInterval(function () {
  client.lLen('gamers', function (err, listSize) {
    if (err) console.log('err', err);
    console.info('Number of current players: ' + (listSize + gamesBeingPlayed * 2));
    console.info('Number of current games: ' + gamesBeingPlayed);
    gameStats = JSON.stringify({ numPlayers: (listSize + gamesBeingPlayed * 2), numGames: gamesBeingPlayed });
  });
}, 1000);

var server = http.createServer(function (req, res) {
  if (url.parse(req.url).pathname === '/game/players') {
    res.writeHead(200, CROSS_ORIGIN_HEADERS);
    res.write(gameStats);
    res.end();
  }
  else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('Go away <3');
  }
});

sockjsServer.installHandlers(server, { prefix: '/game/sockets' });
server.listen(3000);
