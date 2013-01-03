var crypto = require('crypto');
var events = require('events');
var url = require('url');

var requestInterface = require('./request');

var wsConnection = function (request, socket, protocols, host, wsHost, raw) {
	'use strict';

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Setting up the WebSocket connection
	this.protocols = protocols;

	var parsedCookies = requestInterface.parseCookies(request, host);
	this.cookies = parsedCookies.cookies;
	this.headers = request.headers;
	this.langs = requestInterface.parseLangs(request);
	this.session = parsedCookies.session;
	this.url = url.parse(request.url, true);
	this.query = this.url.query;

	Object.defineProperties(this, {
		host: {
			value: wsHost
		},
		raw: {
			value: raw
		},
		sendQueue: {
			value: []
		},
		socket: {
			value: socket
		}
	});
};

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
wsConnection.prototype.broadcast = function () {
	'use strict';

	// Check for raw mode
	var args;
	var data;
	var event;
	var filter;
	if (this.raw) {
		data = arguments[0];
		filter = arguments[1];
		args = [data];
	} else {
		event = arguments[0];
		data = arguments[1];
		filter = arguments[2];
		args = [event, data];
	}

	// If filter is provided filter the clients and send them data
	var clients = filter ? this.host.wsConnections.filter(filter) : this.host.wsConnections;
	var i = clients.length;
	while (i--) {
		clients[i].send.apply(this, args);
	}
};

// Close the wsConnection
wsConnection.prototype.close = function () {
	'use strict';
	this.socket.end(new Buffer([136, 0]));
};

// Send data to the client
wsConnection.prototype.send = function () {
	'use strict';

	// Check for raw mode
	var data = this.raw ? arguments[0] : JSON.stringify({
		event: arguments[0],
		data: arguments[1]
	});

	// Data type, may be binary or text
	var type;
	if (data instanceof Buffer) {
		type = 2;
	} else {
		if (typeof data !== 'string' && !(data instanceof String)) {
			data = JSON.stringify(data);
		}
		data = new Buffer(data);
		type = 1;
	}

	// Header container
	var header;

	// Check for 0 - 125 bytes length data
	if (data.length < 126) {
		header = new Buffer([128 | type, data.length]);
		this.sendQueue.push(Buffer.concat([header, data]));
	}

	// Check for 126 - 65535 bytes length data
	if (data.length > 125 && data.length < 65536) {
		header = new Buffer([128 | type, 126, (65280 & data.length) >> 8, 255 & data.length]);
		this.sendQueue.push(Buffer.concat([header, data]));
	}

	// Check for 65536+ bytes length data
	if (data.length > 65535) {
		// Get first frame
		header = new Buffer([type, 126, 255, 255]);
		this.sendQueue.push(Buffer.concat([header, data.slice(0, 65535)]));
		data = data.slice(65535);

		// Get next frames
		while (data.length > 65535) {
			header = new Buffer([0, 126, 255, 255]);
			this.sendQueue.push(Buffer.concat([header, data.slice(0, 65535)]));
			data = data.slice(65535);
		}

		// Get last frame depending on its length
		if (data.length < 126) {
			header = new Buffer([128, data.length]);
			this.sendQueue.push(Buffer.concat([header, data]));
		} else {
			header = new Buffer([128, 126, (65280 & data.length) >> 8, 255 & data.length]);
			this.sendQueue.push(Buffer.concat([header, data]));
		}
	}

	// Send fragmented frames from send queue splitted in 1024 bytes pieces
	(function sendFragmented() {
		var sendData = this.sendQueue[0];
		if (sendData.length > 1024) {
			this.socket.write(sendData.slice(0, 1024));
			this.sendQueue[0] = sendData.slice(1024);
		} else {
			this.socket.write(sendData);
			this.sendQueue.shift();
		}
		if (this.sendQueue.length) {
			process.nextTick(sendFragmented.bind(this));
		}
	}).call(this);
};

module.exports = function (request, socket, host) {
	'use strict';

	// Shortcuts
	var headers = request.headers;

	// Check for WebSocket protocol version 13 connection and valid host
	if (!(headers.upgrade === 'websocket' && headers['sec-websocket-version'] === '13' && host && headers.origin)) {
		socket.destroy();
		return;
	}

	// Shortcuts
	var config = host.config;
	var connections = host.connections;

	// Check for valid origins
	if (!(headers.host === url.parse(headers.origin).hostname || headers.origin === 'null' || ~this.origins.indexOf(url.parse(request.headers.origin).hostname) || (this.origins[0] === '*' && !~this.origins.indexOf(url.parse(request.headers.origin).hostname)))) {
		socket.destroy();
		return;
	}

	// Check for valid subprotocols
	var protocols = [];
	if (headers['sec-websocket-protocol']) {
		protocols = headers['sec-websocket-protocol'].split(/\s*,\s*/);
		var foundProtocol = protocols.some(function (element) {
			return ~config.protocols.indexOf(element);
		});
		if (!foundProtocol) {
			socket.destroy();
			return;
		}
	} else if (!~config.protocols.indexOf('')) {
		socket.destroy();
		return;
	}

	// Prepare response hash
	var hash = crypto.createHash('sha1')
		.update(headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'utf8')
		.digest('base64');

	// WebSocket HandShake
	socket.write(
		'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
		'Connection: Upgrade\r\n' +
		'Upgrade: WebSocket\r\n' +
		'Sec-WebSocket-Accept: ' + hash + '\r\n' +
		'Sec-WebSocket-Protocol: ' + headers['sec-websocket-protocol'] + '\r\n' +
		'Origin: ' + headers.origin + '\r\n\r\n'
	);

	// Send a ping frame as soon as possible
	process.nextTick(function () {
		socket.write(new Buffer([137, 0]));
	});

	// Current connection object
	var connection = new wsConnection(request, socket, protocols, this, host, config.raw);

	connections.push(connection);
	try {
		host.callback.call(null, connection);
	} catch (error) {
		console.log('\nsimpleS: error in WebSocket host\n' + error.message + '\n');
	}

	var keepAliveTimer;
	var killTimer;

	// Data state containers
	var message = new Buffer(0);
	var dataBuffer = new Buffer(0);
	var parseState = 0;

	// Frame components
	var fin;
	var rsv1;
	var rsv2;
	var rsv3;
	var opcode;
	var mask;
	var payloadLength;
	var maskingKey;
	var payloadData;

	// Process received data
	socket.on('data', function (data) {

		// Buffer data
		dataBuffer = Buffer.concat([dataBuffer, data]);

		// Wait for header
		if (parseState === 0 && dataBuffer.length >= 2) {

			// Header components
			fin = dataBuffer[0] & 128;
			rsv1 = dataBuffer[0] & 64;
			rsv2 = dataBuffer[0] & 32;
			rsv3 = dataBuffer[0] & 16;
			opcode = dataBuffer[0] & 15;
			mask = dataBuffer[1] & 128;
			payloadLength = dataBuffer[1] & 127;

			// Extensions are not supported
			if (rsv1 || rsv2 || rsv3) {
				connection.close();
				return;
			}

			// Reserved non-control frames
			if (opcode > 2 && opcode < 8) {
				connection.close();
				return;
			}

			// Supported control frames
			if (opcode > 7 && opcode < 11) {

				// Control frames should not have more than 125 bits
				if (payloadLength > 125) {
					connection.close();
					return;
				}

				// Control frames should not be fragmented
				if (!fin) {
					connection.close();
					return;
				}
			}

			// Reserved control frames
			if (opcode > 10) {
				connection.close();
				return;
			}

			// Unmasked frame from client
			if (!mask) {
				connection.close();
				return;
			}

			// Extend payload length or wait for masking key
			parseState = payloadLength === 126 ? 1 : payloadLength === 127 ? 2 : 3;

			// Throw away header
			dataBuffer = dataBuffer.slice(2);
		}

		// Wait for 16bit, 64bit payload length or masking key
		if (parseState === 1 && dataBuffer.length >= 2) {
			payloadLength = dataBuffer[0] << 8 | dataBuffer[1];
			parseState = 3;
			dataBuffer = dataBuffer.slice(2);
		} else if (parseState === 2 && dataBuffer.length >= 8) {

			// Most significant bit  should not be 1
			if (dataBuffer[0] & 128) {
				connection.close();
				return;
			}

			// Concatenate bytes
			payloadLength = dataBuffer[0] << 56 | dataBuffer[1] << 48 | dataBuffer[2] << 40 | dataBuffer[3] << 32 | dataBuffer[4] << 24 | dataBuffer[5] << 16 | dataBuffer[6] << 8 | dataBuffer[7];
			parseState = 3;
			dataBuffer = dataBuffer.slice(8);
		} else if (parseState === 3 && dataBuffer.length >= 4) {
			maskingKey = dataBuffer.slice(0, 4);
			parseState = 4;
			dataBuffer = dataBuffer.slice(4);
		}

		// Wait for payload data
		if (parseState === 4 && dataBuffer.length >= payloadLength) {

			// Reset state
			parseState = 0;

			// Keep the connection alive
			clearTimeout(keepAliveTimer);
			clearTimeout(killTimer);
			keepAliveTimer = setTimeout(function () {
				socket.write(new Buffer([137, 0]));
				killTimer = setTimeout(function () {
					socket.destroy();
				}, 10000);
			}, 20000);

			// Check for non-control frame
			if (opcode < 3) {

				// Allocate buffer for payload data
				payloadData = new Buffer(payloadLength);

				// Unmasking payload data
				var i = payloadLength;
				while (i--) {
					payloadData[i] = dataBuffer[i] ^ maskingKey[i % 4];
				}

				// Concatenate payload data to the message
				dataBuffer = dataBuffer.slice(payloadLength);
				message = Buffer.concat([message, payloadData]);

				// Check for last frame
				if (fin) {

					// Modify text messages
					var type = 'binary';
					if (opcode === 1) {
						message = message.toString();
						type = 'text';
						if (!config.raw) {
							try {
								var parsedMessage = JSON.parse(message);
								connection.emit(parsedMessage.event, parsedMessage.data);
							} catch (error) {
								console.log('simpleS: cannot parse incoming WebSocket message using config.raw = false');
							}
						}
					}

					// Emit current message and reset the message buffer
					if (opcode === 2 || opcode === 1 && config.raw) {
						connection.emit('message', {
							data: message,
							type: type
						});
					}
					message = new Buffer(0);
				} else if (message.length > config.length) {

					// Message too big
					connection.close();
					return;
				}
			} else if (opcode === 8) {
				connection.close();
			}
		}
	});

	// Update connection list on client disconnect
	socket.on('close', function () {
		connections.splice(connections.indexOf(connection), 1);
		connection.emit('close');
	});
};