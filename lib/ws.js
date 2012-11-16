var crypto = require('crypto');

var wsConnection = require('./ws_connection');

function ws(request, host) {

	// ES5 strict syntax
	'use strict';

	// Shortcuts
	var headers = request.headers;

	// Check for WebSocket protocol version 13 connection and valid host
	if (!(headers['upgrade'] === 'websocket' && headers['sec-websocket-version'] === '13' && host && headers['sec-websocket-protocol'] && headers['origin'])) {
		socket.destroy();
		return;
	}

	// Shortcuts
	var config = host.config;
	var connections = host.connections;
	var socket = request.socket;

	// Check for valid subprotocols
	var protocols = headers['sec-websocket-protocol'].split(/\s*,\s*/);
	var foundProtocol = protocols.some(function (element) {
		return config.protocols.indexOf(element) >= 0;
	});
	if (!foundProtocol) {
		socket.destroy();
		return;
	}

	// Check for valid origins
	if (config.origins.indexOf(headers['origin']) < 0) {
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
			'Origin: ' + headers['origin'] + '\r\n\r\n'
	);

	// Send a ping frame as soon as possible
	process.nextTick(function () {
		socket.write(Buffer([137, 0]));
	});

	// Current connection object
	var connection = wsConnection(request, host);

	connections.push(connection);
	host.callback(connection);

	var keepAliveTimer;
	var killTimer;

	// Data state containers
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
				socket.write(Buffer([137, 0]));
				killTimer = setTimeout(function () {
					socket.destroy();
				}, 10000);
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
					// Emit current message and reset the message buffer
					connection.emit('message', {
						data: message,
						type: opcode === 1 ? 'text' : 'binary'
					});
					message = Buffer(0);
				} else if (message.length > config.messageMaxLength) {

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
}

module.exports = ws;