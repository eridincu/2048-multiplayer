document.addEventListener("DOMContentLoaded", function () {
  var
    userHash = window.hash(4),
    userNumInterval = false,
    registered = false,
    friendHash = false,
    friendGame = false;

  if (!window.Config)
    throw new Error('config file must be present');

  var sockjsUrl = window.Config.sockjsBaseUrl + '/game/sockets';

  // Wait till the browser is ready to render the game (avoids glitches)
  window.requestAnimationFrame(function () {
    window.io = new SockJS(sockjsUrl);

    /* Dialog Box */
    vex.defaultOptions.className = 'vex-theme-default';
    vex.dialog.open({
      message: 'Welcome to 2048 multiplayer! Use your 2048 skills to beat opponents! <div>\n</div><strong>How it works:</strong><ul><li>You only get 2 minutes</li><li>If you can\'t make anymore legal moves, you lose</li><li>Winner is decided by highest score or by who reaches 2048 first</li></ul> Good luck and may the squares be with you!',
      contentCSS: { width: '940px' },
      buttons: [
        $.extend({}, vex.dialog.buttons.NO, { className: 'vex-dialog-button-primary', text: 'Give us a Tweet', click: function ($vexContent, event) {
            $vexContent.data().vex.value = 'tweet-btn';
            vex.close($vexContent.data().vex.id);
        }}),
        $.extend({}, vex.dialog.buttons.NO, { className: 'vex-dialog-button-2048-friend game-friend-btn', text: 'Play with a friend', click: function ($vexContent, event) {
            $vexContent.data().vex.value = 'friend';
            vex.close($vexContent.data().vex.id);
        }}),
        $.extend({}, vex.dialog.buttons.NO, { className: 'vex-dialog-button-2048-simple game-start-btn', text: 'Find a random opponent', click: function ($vexContent, event) {
            $vexContent.data().vex.value = 'random';
            vex.close($vexContent.data().vex.id);
        }})
      ],
      callback: function(value) {
        if (value === 'random') {
          $('.action-random').show();

          return;
        }

        if (value === 'tweet-btn') {
          var tweetUrl = 'http://twitter.com/share?url=http%3A%2F%2Fbit.ly%2F1lFJnDg&text=Bet%20you%20can%27t%20beat%20me%20in%202048%20Multiplayer!&via=EmilStolarsky';
          window.open(tweetUrl, '_blank').focus();

          return;
        }

        vex.dialog.confirm({
          contentCSS: { width: '550px' },
          message: 'Please choose',
          buttons: [
            $.extend({}, vex.dialog.buttons.YES, {
              className: 'vex-dialog-button-primary',
              text: 'Host game',
              click: function ($vexContent) {
                $vexContent.data().vex.value = 'host';
                vex.close($vexContent.data().vex.id);
              }
            }),
            $.extend({}, vex.dialog.buttons.NO, {
              className: 'vex-dialog-button-primary',
              text: 'Join your friend',
              click: function ($vexContent) {
                $vexContent.data().vex.value = 'join';
                vex.close($vexContent.data().vex.id);
              }
            })
          ],
          callback: function (value) {
            friendGame = true;

            if ('join' === value) {
              vex.dialog.prompt({
                message: 'Find your friend',
                placeholder: 'Your friend unique hash here',
                callback: function (value) {
                  friendHash = value;
                  startGame(value);
                }
              });

              return;
            }

            $('.action-wait-friend').show();
            startGame(null);
          }
        });
      }
    });

    var register = function () {
      if (false !== registered)
        return;

      window.io.send(JSON.stringify({ event: 'register', hash: userHash }));

      window._io = {
        listeners: [],
        oneTimeListeners: [],
        addListener: function (cb) {
          window._io.listeners.push(cb);
        },
        addOneTimeListener: function (callback, onlyWhen) {
          window._io.oneTimeListeners.push({
            cb: callback,
            condition: onlyWhen
          });
        },
        clearListeners: function () {
          window._io.listeners = [];
          window._io.oneTimeListeners = [];
        }
      };

      window.io.onopen = function () {
        console.log('sockjs: open');
      };

      window.io.onmessage = function (event) {
        var msg = JSON.parse(event.data);
        console.log('message:', msg);

        if (msg.stats) {
          return gameStats(msg);
        }

        for (var i = 0, len = window._io.listeners.length; i < len; i++) {
          window._io.listeners[i](msg);
        }

        for (var i = window._io.oneTimeListeners.length - 1; i >= 0; i--) {
          var tempObj = window._io.oneTimeListeners[i];

          if (!!tempObj.condition(msg)) {
            tempObj.cb(msg);
            window._io.oneTimeListeners.splice(i, 1);
          }
        }
      };

      window.io.onclose = function () {
        console.log('sockjs: close');
      };

      registered = true;
    };

    var startGame = function (hash) {
      register();

      /* Socket Listeners! */
      window._io.addListener(function (msg) {
        if (msg.player && msg.size && msg.startCells) {
          window._gameBoard = {};
          window._gameBoard.size = msg.size;
          window._gameBoard.startTiles = msg.startCells;
          window._gameBoard.player = msg.player;
        }
      });

      // wait for random opponent
      if ('undefined' === typeof hash) {
        window.io.send(JSON.stringify({ event: 'find-opponent' }));

      // find your friend with its hash
      } else if (null !== hash) {
        window.io.send(JSON.stringify({ event: 'play-friend', hash: hash }));

      // wait for your friend to find you and give its own hash
      } else {
        window._io.addOneTimeListener(function (msg) {
          friendHash = msg.friendHash;
        }, function (msg) {
          return 'undefined' !== typeof msg.friendHash;
        });
      }

      window._io.addOneTimeListener(function (msg) {
        $('#player-msg .actions').fadeOut();
        $('#player-msg .live').fadeIn();
        $('#player-msg .live').html('<div style="text-align:center">Opponent Found!</div>');

        setTimeout(function () {
          window._io.player = {};
          window._io.player['1'] = 0;
          window._io.player['2'] = 0;
          window._io.gameOver = false;

          var opposingPlayer = window._gameBoard.player === 1 ? 2 : 1;
          var times = 3;

          var countdown = setInterval(function () {
            // Countdown messages
            $('#player-msg .live').html('<div style="text-align:center">Game Will start in <strong>' + times + '</strong></div>');
            times--;

            if (times === -1) {
              clearInterval(countdown);
              clearInterval(userNumInterval);
              userNumInterval = false;

              $('#player-msg .live').html('<div style="text-align:center"><strong> BEGIN!</strong></div>');

              window.localManager = new GameManager({size: window._gameBoard.size, startTiles: window._gameBoard.startTiles, player: window._gameBoard.player, otherPlayer: opposingPlayer, online: false}, KeyboardInputManager, HTMLActuator, io);
              window.onlineManager = new GameManager({size: window._gameBoard.size, startTiles: window._gameBoard.startTiles, player: opposingPlayer, otherPlayer: window._gameBoard.player, online: true}, OnlineInputManager, HTMLActuator, io);

              var gameTimeLeft = window.Config.defaultGameDuration; //game timer

              var timer = setInterval(function () {
                var sec;

                if (gameTimeLeft % 60 === 0)
                  sec = '00';
                else if (('' + gameTimeLeft % 60).length === 1)
                  sec = '0' + gameTimeLeft % 60;
                else
                  sec = gameTimeLeft % 60;

                var min = Math.floor(gameTimeLeft/60);
                $('#player-msg .live').html('<div id="timer"><strong>' + min + ':' + sec + '</strong></div>');
                gameTimeLeft--;

                if (gameTimeLeft === -1) {
                  gameOver(timer);
                }
              }, 750);

              window._io.addOneTimeListener(function () {
                gameOver(timer);
              }, function (msg) {
                return !!msg.gameEnd;
              });
            }
          }, 1000);
        }, 1000);
      }, function (msg) {
        return !!msg.start;
      });
    };

    var gameOver = function (timer, message) {
      message = message || 'Game over!';
      clearInterval(timer);

      $('#player-msg .live').html('<div id="timer"><strong>' + message + '</strong></div>');
      window._io.gameOver = true;

      window.localManager.actuate();
      window.onlineManager.actuate();

      setTimeout(function () {
        $('#player-msg .live').fadeOut();
      }, 1000);

      setTimeout(function () {
        if (friendGame) {
          $('.action-wait-friend').hide();

          if (friendHash) {
            $('.action-again-friend').show();
          }
        }

        $('#player-msg .actions').fadeIn();
      }, 1500);

      setTimeout(function () {
        window._io.clearListeners();

        window._io.addOneTimeListener(function () {
          window.localManager.restart();
          window.onlineManager.restart();
        }, function (msg) {
          return !!msg.start || 'undefined' !== typeof msg.newFriendGame;
        });

        window._io.addOneTimeListener(function () {
          window.localManager.restart();
          window.onlineManager.restart();
          startGame(null);
        }, function (msg) {
          return 'undefined' !== typeof msg.newFriendGame;
        });
      }, 3000);
    };

    var gameStats = function (data) {
      $('#game-stats').fadeIn();
      $('#num-players strong').text(data.numPlayers);
      $('#num-waiters strong').text(data.numWaiters);
      $('#num-games strong').text(data.numGames);
    };

    $('#your-hash strong').text(userHash);

    var startNewGame = function () {
      $('.game-start-btn').on('click', function () {
        $('#player-msg').removeClass('text-center');
        $('#player-msg .actions').fadeOut();
        $('#player-msg .live').fadeIn();
        $('#player-msg .live').html('<div style="text-align:center">Searching for competitor...</div>');
        startGame();
      });

      $('.action-again-friend a').on('click', function () {
        window.io.send(JSON.stringify({ event: 'play-friend', hash: friendHash }));
        window.localManager.restart();
        window.onlineManager.restart();
        startGame(null);
      });
    };

    startNewGame();
  });
});
