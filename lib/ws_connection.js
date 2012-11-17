var events = require('events');

function wsConnection(request, host) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof wsConnection)) {
		return new wsConnection(request, host);
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Setting up the WebSocket connection
	this.host = host;
	this.request = request;
	this.sendQueue = [];
	this.socket = request.socket;
}

// Inherit from events.EventEmitter
wsConnection.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: wsConnection,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Send data to all active clients or a part of them
wsConnection.prototype.broadcast = function (data, filter) {
	var clients;
	if (filter) {
		clients = this.host.wsConnections.filter(filter);
	} else {
		clients = this.host.wsConnections;
	}
	var i = clients.length;
	while (i--) {
		clients[i].send(data);
	}
};

// Close the wsConnection
wsConnection.prototype.close = function () {
	this.socket.end(Buffer([136, 0]));
};

// Return all active wsConnections to the WebSocket host
wsConnection.prototype.getwsConnections = function () {
	return this.host.wsConnections.slice(0);
};

// Return the origin of the WebSocket wsConnection
wsConnection.prototype.getOrigin = function () {
	return this.request.headers['origin'];
};

// Return the array of protocols of the WebSocket wsConnection
wsConnection.prototype.getProtocols = function () {
	return this.request.headers['sec-websocket-protocol'].split(/\s*,\s*/);;
};

// Return wsConnection request
wsConnection.prototype.getRequest = function () {
	return this.request;
};

// Return wsConnection tcp socket
wsConnection.prototype.getSocket = function () {
	return this.socket;
};

// Send data to the client
wsConnection.prototype.send = function (data) {

	// Do nothing if there is nothing to send
	if (data === undefined) {
		return;
	}

	// Data type, may be binary or text
	var type;
	if (data instanceof Buffer) {
		type = 2;
	} else {
		if (typeof data !== 'string') {
			data = JSON.stringify(data.valueOf());
		}
		data = Buffer(data);
		type = 1;
	}

	// Header container
	var header;

	// Check for 0 - 125 bytes length data
	if (data.length < 126) {
		header = Buffer([128 | type, data.length]);
		this.sendQueue.push(Buffer.concat([header, data]));
	}

	// Check for 126 - 65535 bytes length data
	if (data.length > 125 && data.length < 65536) {
		header = Buffer([128 | type, 126, (65280 & data.length) >> 8, 255 & data.length]);
		this.sendQueue.push(Buffer.concat([header, data]));
	}

	// Check for 65536+ bytes length data
	if (data.length > 65535) {
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
		if (data.length < 126) {
			header = Buffer([128, data.length]);
			this.sendQueue.push(Buffer.concat([header, data]));
		} else {
			header = Buffer([128, 126, (65280 & data.length) >> 8, 255 & data.length]);
			this.sendQueue.push(Buffer.concat([header, data]));
		}
	}

	// Link to this context
	var that = this;

	// Prepare sending frames from send queue and fragment them in 1024 bytes pieces
	function sendFragmented() {
		if (that.sendQueue.length) {
			var sendData = that.sendQueue[0];
			if (sendData.length >= 1024) {
				that.socket.write(sendData.slice(0, 1024));
				that.sendQueue[0] = sendData.slice(1024);
			} else {
				that.socket.write(sendData);
				that.sendQueue[0] = Buffer(0);
			}
			if (that.sendQueue[0].length === 0) {
				that.sendQueue.shift();
			}
			process.nextTick(sendFragmented);
		}
	}

	// Start fragmentation and sending
	sendFragmented();
};

module.exports = wsConnection;