var ws = require("nodejs-websocket")

var isListening = false;
var interfaces = {};

var MessageType = {
    SIGNAL: 1,
    INIT: 3,
    IDLE: 4,
    INVOKEMETHOD: 6,
    CONNECTTOSIGNAL: 7,
    RESPONSE: 10
};

// Serialize object and return it in JSON form
function serializeObject(object) {
    var methods = [];
    var signals = [];

    for (var key in object) {
	if (typeof object[key] == "function") {
	    methods.push(key);
	} else if (typeof object[key] == "object") {
	    signals.push(key);
	}
    }

    return {
	methods: function() { return methods.map(function(key) { return [ key, methods.indexOf(key) + 1 ]; });  }(),
	signals: function() { return signals.map(function(key) { return [ key, signals.indexOf(key) + 1 ]; });  }(),
	properties: []
    }
}

// Get all methods from the interface object
function getInterfaceMethods(object) {
    var methods = [];
    for (var key in object) {
	if (typeof object[key] == "function") {
	    methods.push(object[key]);
	}
    }

    return methods;
}

// Get all signals from the interface object
function getInterfaceSignals(object) {
    var signals = [];
    for (var key in object) {
	if (typeof object[key] == "object") {
	    signals.push(object[key]);
	}
    }

    return signals;
}

function interfaceExists(interfaceName) {
    if (typeof interfaces[interfaceName] == "undefined") {
	console.error("Interface " + interfaceName + " not found!");
	return false;
    }

    return true;
}

// Handle INIT message type
function handleInit(socket, message) {
    var data = {};

    for (var interface in interfaces) {
	data = Object.assign(data, { [interface]: serializeObject(interfaces[interface]) });
    }

    socket.sendText(JSON.stringify({ data: data, id: message.id, type: MessageType.RESPONSE }));
}

// Handle INVOKEMETHOD message type
function handleInvokeMethod(message) {
    if (!interfaceExists(message.object))
	return;

    var methods = getInterfaceMethods(interfaces[message.object]);

    if (message.method > methods.length) {
	console.error("Method index " + message.method + " not found in interface " + message.object + "!");
	return;
    }

    if (methods[message.method - 1].length != message.args.length) {
	console.error("Invalid number of arguments");
	return;
    }

    methods[message.method - 1].apply(interfaces[message.object], message.args);
}

// Handle CONNECTTOSIGNAL message type
function handleConnectToSignal(socket, message) {
    if (!interfaceExists(message.object))
	return;

    var signals = getInterfaceSignals(interfaces[message.object]);

    if (typeof signals[message.signal - 1] == "undefined") {
	console.error("Signal index " + message.signal + " not found in interface " + message.object + "!");
	return;
    }

    signals[message.signal - 1].socket = socket;
}

module.exports = {
    listen: function(host, port) {
	ws.createServer(function(socket) {
	    socket.on('text', function(text) {
		isListening = true;

		try {
		    var message = JSON.parse(text);
		    console.log(message);
		    switch (message.type) {
		    case MessageType.INIT:
			handleInit(socket, message);
			break;

		    case MessageType.IDLE:
			break;

		    case MessageType.INVOKEMETHOD:
			handleInvokeMethod(message);
			break;

		    case MessageType.CONNECTTOSIGNAL:
			handleConnectToSignal(socket, message);
		    }
		} catch (e) {
		   console.error("Failed to parse message received from the client: " + e);
		}
	    });
	}).listen(port, host);
    },

    registerInterface: function(interfaceName, interfaceObject) {
	function applyScopeToEmitFunctions() {
	    var signalIndex = -1;

	    for (var key in interfaceObject) {
		if (typeof interfaceObject[key] == "object") {
		    interfaceObject[key].emit = interfaceObject[key].emit.bind({ interfaceName: interfaceName,
										 signalName: key,
										 signalIndex: ++signalIndex + 1 });
		}
	    }
	}

	if (isListening) {
	    console.error("Cannot register interface " + interfaceName + " while listening");
	    return false;
	}

	if (typeof interfaces[interfaceName] != "undefined") {
	    console.error("The interface " + interfaceName + " is already registered!");
	    return false;
	}

	interfaces[interfaceName] = interfaceObject;

	applyScopeToEmitFunctions();

	return interfaceObject;
    },

    method: function(callback) {
	return callback;
    },

    signal: {
	emit: function() {
	    var message = { object: this.interfaceName,
			    signal: this.signalIndex,
			    args: Array.prototype.slice.call(arguments),
			    type: MessageType.SIGNAL };

	    interfaces[this.interfaceName][this.signalName].socket.sendText(JSON.stringify(message));
	}
    }
}
