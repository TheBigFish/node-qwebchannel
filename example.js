var QWebChannel = require('qwebchannel');

var progressInterval = 0;
var progress = 0;

var Player = QWebChannel.registerInterface("Player", {
    // Method
    play: QWebChannel.method(function(s) {
	console.log("play");

	progressInterval = setInterval(function() {
	    console.log("progressChanged");
	    Player.progressChanged.emit(progress++);
	}, 100);
    }),

    // Method
    stop: QWebChannel.method(function() {
	console.log("stop");

	clearInterval(progressInterval);
	progress = 0;
    }),

    // Signal
    progressChanged: QWebChannel.signal,
});

QWebChannel.listen("0.0.0.0", 2001);
