var events = require('events');

var connection = module.exports = function (request, socket, protocols) {
	'use strict';

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define visible properties
	this.protocols = protocols;
	this.headers = request.headers;

	// Define hidden properties
	Object.defineProperties(this, {
		raw: {
			value: false,
			writable: true
		},
		sendQueue: {
			value: []
		},
		socket: {
			value: socket
		}
	});

	// Make it possible to bind to more than 10 channels
	this.setMaxListeners(0);
};

// Inherit from events.EventEmitter
connection.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: connection,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Close the connection
connection.prototype.close = function () {
	'use strict';
	this.socket.end(Buffer([136, 0]));
};

// Send data to the client
connection.prototype.send = function () {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Prepare data
	var data;
	if (this.raw) {
		data = arguments[0];
	} else {
		data = {
			event: arguments[0],
			data: arguments[1]
		};
	}

	// Data type, may be binary or text
	var type;
	if (data instanceof Buffer) {
		type = 2;
	} else {
		if (typeof data !== 'string' && !(data instanceof String)) {
			data = JSON.stringify(data);
		}
		data = Buffer(data);
		type = 1;
	}

	// Prepare data depending on its length
	var header;
	var length = data.length;
	if (length < 126) {
		header = Buffer([128 | type, length]);
	} else if (length < 65536) {
		header = Buffer([128 | type, 126, (65280 & length) >> 8, 255 & length]);
	} else if (length > 65535) {

		// Get first frame
		header = Buffer([type, 126, 255, 255]);
		this.sendQueue.push(Buffer.concat([header, data.slice(0, 65535)]));
		data = data.slice(65535);

		// Get next frames
		while (data.length > 65535) {
			header = Buffer([0, 126, 255, 255]);
			this.sendQueue.push(Buffer.concat([header, data.slice(0, 65535)]));
			data = data.slice(65535);
		}

		// Get last frame depending on its length
		if (length < 126) {
			header = Buffer([128, data.length]);
		} else {
			header = Buffer([128, 126, (65280 & length) >> 8, 255 & length]);
		}
	}

	// Push the data to the queue
	this.sendQueue.push(Buffer.concat([header, data]));

	// Send fragmented frames from send queue splitted in 1024 bytes pieces
	function sendFragmented() {

		// Get the first element of the queue
		var sendData = that.sendQueue[0];

		// If data is bigger than 1kB fragment and send it
		if (sendData.length > 1024) {
			that.socket.write(sendData.slice(0, 1024));
			that.sendQueue[0] = sendData.slice(1024);
		} else {
			that.socket.write(sendData);
			that.sendQueue.shift();
		}

		// If there are more elements send them on next tick
		if (that.sendQueue.length) {
			process.nextTick(sendFragmented);
		}
	}

	// Start sending frames
	sendFragmented();
};