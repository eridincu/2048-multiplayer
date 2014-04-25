document.addEventListener("DOMContentLoaded", function () {
  var
    userHash = window.hash(4),
    userNumInterval = false,
    registered = false,
    friendHash = false,
    sockjs,
    multiplexer;

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
        $.extend({}, vex.dialog.buttons.NO, { className: 'vex-dialog-button-2048-friend game-friend-btn', text: 'Play with a Friend', click: function ($vexContent, event) {
            $vexContent.data().vex.value = '2048-friend';
            vex.close($vexContent.data().vex.id);
        }}),
        $.extend({}, vex.dialog.buttons.NO, { className: 'vex-dialog-button-2048-simple game-start-btn', text: 'Find a Competitor', click: function ($vexContent, event) {
            $vexContent.data().vex.value = '2048-simple';
            vex.close($vexContent.data().vex.id);
        }})
      ],
      callback: function(value) {
        if (value === 'tweet-btn') {
          var tweetUrl = 'http://twitter.com/share?url=http%3A%2F%2Fbit.ly%2F1lFJnDg&text=Bet%20you%20can%27t%20beat%20me%20in%202048%20Multiplayer!&via=EmilStolarsky';
          window.open(tweetUrl, '_blank').focus();
          return;
        }
      }
    });

    var startNewGame = function () {
      $('.game-start-btn').on('click', function () {
        $('#player-msg').removeClass('text-center');
        $('#player-msg .actions').fadeOut();
        $('#player-msg .live').html('<span style="float:left">Searching for competitor </span>\n<span class="ellipsis">.</span>\n<span class="ellipsis">.</span>\n<span class="ellipsis">.</span>');
        gameStats();
        startGame();
      });

      $('.game-friend-btn').on('click', function () {
        vex.dialog.confirm({
          contentCSS: { width: '550px' },
          message: 'Please choose',
          buttons: [
            $.extend({}, vex.dialog.buttons.YES, { className: 'vex-dialog-button-primary', text: 'Host game', click: function($vexContent, event) {
                $vexContent.data().vex.value = 'host';
                vex.close($vexContent.data().vex.id);
            }}),
            $.extend({}, vex.dialog.buttons.NO, { className: 'vex-dialog-button-primary', text: 'Join your friend', click: function($vexContent, event) {
                $vexContent.data().vex.value = 'join';
                vex.close($vexContent.data().vex.id);
            }})
          ],
          callback: function (value) {
            if ('join' === value) {
              vex.dialog.prompt({
                message: 'Find your friend',
                placeholder: 'Your friend unique hash here',
                callback: function (value) {
                  window.friendHash = value;
                  gameStats();
                  startGame(value);
                }
              });
              return;
            }

            gameStats();
            startGame(null);
          }
        });
      });
    };

    var register = function () {
      if (false !== registered)
        return;

      io.send(JSON.stringify({ event: 'register', hash: userHash }));
      registered = true;
    };

    var startGame = function (hash) {
      var io = window.io;
      register();

      if ('undefined' === typeof hash)
        io.send(JSON.stringify({ event: 'find-opponent' }));
      else if (null !== hash)
        io.send(JSON.stringify({ event: 'play-friend', hash: hash }));

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

      io.onopen = function() {
        console.log('sockjs: open');
      };

      io.onmessage = function(event) {
        var msg = JSON.parse(event.data);
        console.log('message:', msg);

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

      /* Socket Listeners! */
      window._io.addListener(function (msg) {
        if (msg.player && msg.size && msg.startCells) {
          window._gameBoard = {};
          window._gameBoard.size = msg.size;
          window._gameBoard.startTiles = msg.startCells;
          window._gameBoard.player = msg.player;
        }
      });

      window._io.addOneTimeListener(function (msg) {
        $('#player-msg .actions').fadeOut();
        $('#player-msg .live').html('Opponent Found!');

        setTimeout(function () {
          window._io.player = {};
          window._io.player['1'] = 0;
          window._io.player['2'] = 0;
          window._io.gameOver = false;

          var opposingPlayer = window._gameBoard.player === 1 ? 2 : 1;
          var times = 3;

          var countdown = setInterval(function () {
            // Countdown messages
            $('#player-msg .live').html('<div style="text-align: center">Game Will start in <strong>' + times + '</strong></div>');
            times--;

            if (times === -1) {
              clearInterval(countdown);
              clearInterval(userNumInterval);
              userNumInterval = false;

              $('#player-msg .live').html('<div style="text-align: center"><strong> BEGIN!</strong></div>');
              var localManager = new GameManager({size: window._gameBoard.size, startTiles: window._gameBoard.startTiles, player: window._gameBoard.player, otherPlayer: opposingPlayer, online: false}, KeyboardInputManager, HTMLActuator, io),
              onlineManager = new GameManager({size: window._gameBoard.size, startTiles: window._gameBoard.startTiles, player: opposingPlayer, otherPlayer: window._gameBoard.player, online: true}, OnlineInputManager, HTMLActuator, io);

              var gameOver = function (timer, message) {
                message = message || 'Game over!';
                clearInterval(timer);
                gameStats();

                $('#player-msg .live').html('<div id="timer"><strong>' + message + '</strong></div>');
                window._io.gameOver = true;

                localManager.actuate();
                onlineManager.actuate();

                setTimeout(function () {
                  $('#player-msg .live').fadeOut();
                }, 1000);

                setTimeout(function () {
                  $('#player-msg .live').html('');
                  $('#player-msg .actions').fadeIn();
                }, 1500);

                setTimeout(function () {
                  startNewGame();

                  window._io.clearListeners();
                  $('.game-start-btn').on('click', function () {
                    localManager.restart();
                    onlineManager.restart();
                  });
                }, 3000);
              };

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

              window._io.addOneTimeListener(function (msg) {
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

      io.onclose = function () {
        console.log('sockjs: close');
      };
    };

    var gameStats = function () {
      if (false !== userNumInterval)
        return;

      $('#game-stats').fadeIn();
      userNumInterval = setInterval(function () {
        $.get('http://localhost:3000/game/players', function (data) {
          data = JSON.parse(data);
          $('#num-players strong').text(data.numPlayers);
          $('#num-waiters strong').text(data.numWaiters);
          $('#num-games strong').text(data.numGames);
        });
      }, 1000);
    };

    $('#your-hash strong').text(userHash);
    startNewGame();
  });
});
