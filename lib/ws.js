var crypto = require('crypto');
var url = require('url');

var requestInterface = require('./request');
var wsConnection = require('./ws/connection');

// WebSocket handler
module.exports = function (request, socket) {
	'use strict';

	// Set socket keep alive time to 25 seconds
	socket.setTimeout(25000);

	// Prepare data for WebSocket host
	var hostname = request.headers.host;
	var index = hostname.indexOf(':');

	// Remove the port from the hostname
	if (index > 0) {
		hostname = hostname.substring(0, index);
	}

	var host = this.hosts[hostname] || this.hosts.main;
	request = new requestInterface(request, null, host);

	var wsHost = host.wsHosts[request.url.path];

	// Inactive WebSocket host
	if (!wsHost || !wsHost.started) {
		socket.destroy();
		return;
	}

	// Shortcuts
	var headers = request.headers;
	var config = wsHost.config;
	var connections = wsHost.connections;
	var origin;
	var index;
	var protocols;
	if (headers.origin) {
		origin = url.parse(headers.origin).host;
		index = ~host.origins.indexOf(origin);
	}
	if (headers['sec-websocket-protocol']) {
		protocols = headers['sec-websocket-protocol'].split(/\s*,\s*/).sort();
	}

	// Check for valid connection handshake
	if (!headers.origin ||
		headers.upgrade !== 'websocket' ||
		headers['sec-websocket-version'] !== '13' ||
		!headers['sec-websocket-protocol'] ||
		headers.host !== origin &&
		(!index || host.origins[0] !== '*' && index) ||
		(protocols < config.protocols || protocols > config.protocols)) {
		socket.destroy();
		return;
	}

	// Prepare response hash
	var hash = crypto.createHash('sha1');
	var key = headers['sec-websocket-key'];
	hash.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'utf8');

	// WebSocket HandShake
	socket.write(
		'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
		'Connection: Upgrade\r\n' +
		'Upgrade: WebSocket\r\n' +
		'Sec-WebSocket-Accept: ' + hash.digest('base64') + '\r\n' +
		'Sec-WebSocket-Protocol: ' + headers['sec-websocket-protocol'] + '\r\n' +
		'Origin: ' + headers.origin + '\r\n\r\n'
	);

	// Current connection object
	var connection = new wsConnection(request, socket, protocols, host);
	var parsedCookies = requestInterface.parseCookies(request, host);
	connection.cookies = parsedCookies.cookies;
	connection.langs = requestInterface.parseLangs(request);
	connection.raw = config.raw;
	connection.session = parsedCookies.session;
	var keepAliveTimer;

	connection.on('close', function () {
		clearTimeout(keepAliveTimer);
	});

	connections.push(connection);
	try {
		wsHost.callback.call(host, connection);
	} catch (error) {
		console.log('\nsimpleS: error in WebSocket host\n' + error.message + '\n');
	}

	// Data state containers
	var closeData = Buffer([136, 0]);
	var pingData = Buffer([137, 0]);
	var message = Buffer(0);
	var dataBuffer = Buffer(0);
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
	var reserved;
	var unknownType;

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

			// Extensions, unknown frame type or unmasked message
			reserved = rsv1 || rsv2 || rsv3;
			unknownType = (opcode > 2 && opcode < 8) || opcode > 10;
			if (reserved || unknownType || !mask) {
				socket.end(closeData);
				return;
			}

			// Supported control frames
			if (opcode > 7 && opcode < 11) {

				// Control frames should be <= 125 bits and not be fragmented
				if (payloadLength > 125 || !fin) {
					socket.end(closeData);
					return;
				}
			}

			// Extend payload length or wait for masking key
			if (payloadLength === 126) {
				parseState = 1;
			} else if (payloadLength === 127) {
				parseState = 2;
			} else {
				parseState = 3;
			}

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
				socket.end(closeData);
				return;
			}

			// Concatenate payload length
			payloadLength = dataBuffer[0] << 56;
			payloadLength |= dataBuffer[1] << 48;
			payloadLength |= dataBuffer[2] << 40;
			payloadLength |= dataBuffer[3] << 32;
			payloadLength |= dataBuffer[4] << 24;
			payloadLength |= dataBuffer[5] << 16;
			payloadLength |= dataBuffer[6] << 8;
			payloadLength |= dataBuffer[7];
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
			keepAliveTimer = setTimeout(function () {
				socket.write(pingData);
			}, 20000);

			// Check for non-control frame
			if (opcode < 3) {

				// Allocate buffer for payload data
				payloadData = Buffer(payloadLength);

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
								console.log('message: ' + message);
								console.log(error.stack);
							}
						}
					}

					// Emit current message and reset the message buffer
					if (opcode === 2 || opcode === 1 && config.raw) {
						try {
							connection.emit('message', {
								data: message,
								type: type
							});
						} catch (error) {
							console.log('simpleS: error on receiving message');
						}
					}
					message = Buffer(0);
				} else if (message.length > config.length) {

					// Message too big
					socket.end(closeData);
					return;
				}
			} else if (opcode === 8) {
				socket.end(closeData);
			}
		}
	});

	// Update connection list on client disconnect
	socket.on('close', function () {
		var index = 0;
		while (connections[index] !== connection) {
			index++;
		}
		connections.splice(index, 1);
		connection.emit('close');
	});
};