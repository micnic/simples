'use strict';

var crypto = require('crypto'),
	url = require('url'),
	utils = require('../utils/utils'),
	wsConnection = require('./ws/connection');

// Unmask the WebSocket data
function wsUnmasking(connection, frame) {

	var data,
		index,
		length,
		size;

	// Set the amount of bytes to be unmasked
	if (frame.data.length >= frame.length) {
		index = size = frame.length;
	} else if (frame.data.length > 16384) {
		index = size = 16384;
	}

	// Check if any data is available
	if (size) {

		// Loop through the data un apply xor operation
		while (index--) {
			frame.data[index] ^= frame.mask[index % 4];
		}

		// Concatenate payload data to the message
		data = frame.data.slice(0, size);
		length = frame.message.length + size;
		frame.message = utils.buffer(frame.message, data, length);

		// Cut off the read data
		frame.data = frame.data.slice(size);
		frame.length -= size;

		// Parse message or unmask more data
		if (frame.fin && !frame.length) {
			wsMessageParse(connection, frame);
		} else {
			setImmediate(wsUnmasking, connection, frame);
		}
	}
}

// Parse messages received via WebSocket
function wsMessageParse(connection, frame) {

	// Stringify text messages
	if (frame.opcode === 1) {
		frame.message = frame.message.toString();
	}

	// Prepare messages depending on their type
	if (frame.opcode === 2 || connection.config.raw) {
		connection.emit('message', {
			data: frame.message,
			type: frame.opcode === 1 && 'text' || 'binary'
		});
	} else {
		try {
			frame.message = JSON.parse(frame.message);
			connection.emit(frame.message.event, frame.message.data);
		} catch (error) {
			console.error('\nsimpleS: cannot parse incoming WebSocket message');
			console.error(error.stack + '\n');
		}
	}

	// Reset frame state
	frame.message = new Buffer(0);
	frame.state = 0;

	// Continue parsing if more data available
	if (frame.data.length >= 2) {
		setImmediate(wsParse, connection, frame, frame.data);
	}
}

// Parse data received via WebSocket
function wsParse(connection, frame, data) {

	var length;

	// Destroy the TCP socket
	function socketDestroy() {
		connection.socket.destroy();
	}

	data = data || new Buffer(0);
	length = frame.data.length + data.length;

	// Concatenate frame data with the received data
	frame.data = utils.buffer(frame.data, data, length);

	// Wait for header
	if (frame.state === 0 && frame.data.length >= 2) {

		// Header components
		frame.fin = frame.data[0] & 128;
		frame.opcode = frame.data[0] & 15;
		frame.length = frame.data[1] & 127;

		// Check for extensions (reserved bits)
		if (frame.data[0] & 112) {
			console.error('\nsimpleS: WebSocket does not support extensions\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Check for unknown frame type
		if ((frame.opcode & 7) > 2) {
			console.error('\nsimpleS: Unknown WebSocket frame type\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Control frames should be <= 125 bits and not be fragmented
		if (frame.opcode > 7 && (frame.length > 125 || !frame.fin)) {
			console.error('\nsimpleS: Invalid WebSocket control frame\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Check for mask flag
		if (!(frame.data[1] & 128)) {
			console.error('\nsimpleS: Unmasked frame received\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Extend payload length or wait for masking key
		if (frame.length === 126) {
			frame.state = 1;
		} else if (frame.length === 127) {
			frame.state = 2;
		} else {
			frame.state = 3;
		}

		// Throw away header
		if (frame.opcode === 8) {
			connection.socket.end(new Buffer([136, 0]));
			frame.state = -1;
		} else if (frame.opcode === 9) {
			console.error('\nsimpleS: Ping frame received\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		} else if (frame.opcode === 10) {
			frame.data = frame.data.slice(6 + frame.length);
			frame.state = 0;
		} else {
			frame.index = 2;
		}
	}

	// Wait for 16bit, 64bit payload length
	if (frame.state === 1 && frame.data.length >= 4) {
		frame.length = frame.data.readUInt16BE(2);
		frame.index += 2;
		frame.state = 3;
	} else if (frame.state === 2 && frame.data.length >= 10) {

		// Don't accept payload length bigger than 32bit
		if (frame.data.readUInt32BE(2)) {
			console.error('\nsimpleS: Can not use 64bit payload length\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Limit payload length to 32bit (4GB)
		frame.length = frame.data.readUInt32BE(6);
		frame.index += 8;
		frame.state = 3;
	}

	// Wait for masking key
	if (frame.state === 3 && frame.data.length - frame.index >= 4) {

		// Check if message is not too big
		if (frame.length + frame.message.length > connection.config.limit) {
			console.error('\nsimpleS: Too big WebSocket message\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Get the masking key
		frame.mask = frame.data.slice(frame.index, frame.index + 4);
		frame.data = frame.data.slice(frame.index + 4);
		frame.index = 0;
		frame.state = 4;
	}

	// Wait for payload data
	if (frame.state === 4) {
		wsUnmasking(connection, frame);
	}
}

// Make the WebSocket handshake
function wsHandshake(host, connection, key) {

	var frame = {
			data: new Buffer(0),
			index: 0,
			message: new Buffer(0),
			state: 0
		},
		log,
		socket = connection.socket,
		timer;

	// Send a ping frame each 25 seconds of inactivity
	function keepAlive() {
		clearTimeout(timer);
		timer = setTimeout(function () {
			socket.write(new Buffer([137, 0]));
		}, 25000);
	}

	// Set socket keep alive time to 30 seconds
	socket.setTimeout(30000);

	// Write the handshake to the socket
	socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n');
	socket.write('Connection: Upgrade\r\n');
	socket.write('Upgrade: WebSocket\r\n');
	socket.write('Sec-WebSocket-Accept: ' + key + '\r\n');

	// Write origin only if requested
	if (connection.headers.origin) {
		socket.write('Origin: ' + connection.headers.origin + '\r\n');
	}

	// End the WebSocket handshake
	socket.write('\r\n');

	// Parse received data
	socket.on('readable', function () {
		keepAlive();
		wsParse(connection, frame, this.read());
	}).on('close', function () {
		host.connections.splice(host.connections.indexOf(connection), 1);
		clearTimeout(timer);
		connection.emit('close');
	});

	// Check if any logger is defined
	if (host.parent.logger) {

		log = {};

		Object.keys(connection).filter(function (attribute) {
			return typeof connection[attribute] !== 'function';
		}).forEach(function (attribute) {
			log[attribute] = connection[attribute];
		});

		log = host.parent.logger(log);

		// Check if the logger has defined a result
		if (typeof log !== 'undefined') {
			console.log(log);
		}
	}

	// Execute user defined code for the WebSocket host
	try {
		host.callback(connection);
		keepAlive();
	} catch (error) {
		console.error('\nsimpleS: Error in WebSocket');
		console.error(error.stack + '\n');
		socket.destroy();
	}
}

// WebSocket request listener
exports.wsRequestListener = function (request, socket) {

	var connection,
		error,
		host,
		key = request.headers['sec-websocket-key'];

	// Check if host is provided by the host header
	if (request.headers.host) {
		host = this.parent.hosts[request.headers.host.split(':')[0]];
	}

	// Get the main host if the other one does not exist or is inactive
	if (!host || !host.active) {
		host = this.parent.hosts.main;
	}

	// Select the WebSocket host
	host = host.wsHosts[url.parse(request.url).pathname];

	// Check for WebSocket host
	if (!host || !host.active) {
		error = '\nsimpleS: Request to an inactive WebSocket host\n';
	}

	// Check for valid upgrade header
	if (request.headers.upgrade !== 'websocket') {
		error = '\nsimpleS: Unsupported WebSocket upgrade header\n';
	}

	// Check for WebSocket handshake key
	if (!key) {
		error = '\nsimpleS: No WebSocket handshake key\n';
	}

	// Check for WebSocket subprotocols
	if (!request.headers['sec-websocket-protocol']) {
		error = '\nsimpleS: No WebSocket subprotocols\n';
	}

	// Check for valid WebSocket protocol version
	if (request.headers['sec-websocket-version'] !== '13') {
		error = '\nsimpleS: Unsupported WebSocket version\n';
	}

	// Check for accepted origin
	if (request.headers.origin && !utils.accepts(host.parent, request)) {
		error = '\nsimpleS: WebSocket origin not accepted\n';
	}

	// Check for error and make the WebSocket handshake
	if (error) {
		console.error(error);
		socket.destroy();
	} else {

		// Create a new WebSocket connection
		connection = new wsConnection(host.parent, host.config, request);
		host.connections.push(connection);

		// Determine the response handshake key
		crypto.Hash('sha1').on('readable', function () {
			wsHandshake(host, connection, this.read().toString('base64'));
		}).end(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
	}
};