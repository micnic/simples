'use strict';

var domain = require('domain'),
	utils = require('simples/utils/utils');

// WS namespace
var ws = exports;

// Link to the WS connection prototype constructor
ws.connection = require('simples/lib/ws/connection');

// Link to the WS host prototype constructor
ws.host = require('simples/lib/ws/host');

// The WebSocket GUID
ws.guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Listener for WS requests
ws.connectionListener = function (host, request) {

	var connection = new utils.ws.connection(host, request),
		error = '',
		parent = host.parent;

	// Check for WS errors
	if (connection.headers.upgrade !== 'websocket') {
		error = 'Unsupported WebSocket upgrade header';
	} else if (!connection.key) {
		error = 'No WebSocket handshake key';
	} else if (connection.headers['sec-websocket-version'] !== '13') {
		error = 'Unsupported WebSocket version';
	} else if (!utils.accepts(parent, connection)) {
		error = 'WebSocket origin not accepted';
	}

	// Check if any errors appeared and continue connection processing
	if (error) {

		// Emit the error to the host if it has any error listeners
		if (host.listeners('error').length) {
			host.emit('error', new Error(error));
		}

		// Destroy the connection socket
		connection.socket.destroy();
	} else {
		connection.pipe(connection.socket);
		host.connections.push(connection);
		utils.ws.prepareHandshake(connection);
	}
};

// Generate default config for hosts
ws.defaultConfig = function () {

	return {
		limit: 1048576, // bytes, by default 1 MB
		mode: 'advanced', // can be 'advanced' or 'raw'
		type: 'text' // can be 'binary' or 'text'
	};
};

// Parse received WS data
ws.parse = function (connection, frame, data) {

	var error = '',
		length = 0;

	// Prepare data for concatenation
	data = data || new Buffer(0);
	length = frame.data.length + data.length;

	// Concatenate frame data with the received data
	frame.data = Buffer.concat([frame.data, data], length);

	// Wait for header
	if (frame.state === 0 && frame.data.length >= 2) {

		// Get header components
		frame.fin = frame.data[0] & 128;
		frame.opcode = frame.data[0] & 15;
		frame.length = frame.data[1] & 127;

		// Set read index after the header
		frame.index = 2;

		// Check for WebSocket errors
		if (frame.data[0] & 112) {
			error = 'WebSocket extensions are not supported';
		} else if ((frame.opcode & 7) > 2) {
			error = 'Unknown WebSocket frame type';
		} else if (frame.opcode > 7 && (frame.length > 125 || !frame.fin)) {
			error = 'Invalid WebSocket control frame';
		} else if (frame.opcode === 9) {
			error = 'Ping frame received';
		} else if (!(frame.data[1] & 128)) {
			error = 'Unmasked frame received';
		}

		// Emit errors and check for close and pong frame, wait for data length
		if (error) {
			connection.emit('error', new Error(error));
			connection.socket.destroy();
			frame.state = -1;
		} else if (frame.opcode === 8) {
			connection.end();
			frame.state = 5;
		} else if (frame.opcode === 10) {
			frame.data = frame.data.slice(frame.length + 6);
			frame.state = 0;
		} else if (frame.length === 126) {
			frame.state = 1;
		} else if (frame.length === 127) {
			frame.state = 2;
		} else {
			frame.state = 3;
		}
	}

	// Wait for 16bit or get only 32bit from 64bit payload length
	if (frame.state === 1 && frame.data.length >= 4) {
		frame.length = frame.data.readUInt16BE(2);
		frame.index += 2;
		frame.state = 3;
	} else if (frame.state === 2 && frame.data.length >= 10) {
		if (frame.data.readUInt32BE(2)) {
			connection.emit('error', new Error('Undue frame payload length'));
			connection.socket.destroy();
			frame.state = -1;
		} else {
			frame.length = frame.data.readUInt32BE(6);
			frame.index += 8;
			frame.state = 3;
		}
	}

	// Wait for masking key
	if (frame.state === 3 && frame.data.length - frame.index >= 4) {

		// Check if message is not too big and get the masking key
		if (frame.length + frame.message.length > frame.limit) {
			connection.emit('error', new Error('Too big WebSocket message'));
			connection.socket.destroy();
			frame.state = -1;
		} else {
			frame.mask = frame.data.slice(frame.index, frame.index + 4);
			frame.data = frame.data.slice(frame.index + 4);
			frame.index = 0;
			frame.state = 4;
		}
	}

	// Wait for payload data
	if (frame.state === 4) {
		ws.unmasking(connection, frame);
	}
};

// Parse received WS messages
ws.parseMessage = function (connection, frame) {

	var type = 'text';

	// Stringify text messages or set binary type
	if (frame.opcode === 1) {
		frame.message = frame.message.toString();
	} else {
		type = 'binary';
	}

	// Prepare messages depending on their type
	if (connection.mode === 'raw') {
		connection.emit('message', {
			data: frame.message,
			type: type
		});
	} else {
		domain.create().on('error', function (error) {
			connection.emit('error', error);
		}).run(function () {
			frame.message = JSON.parse(frame.message);
			connection.emit(frame.message.event, frame.message.data);
		});
	}

	// Reset frame object
	frame.message = new Buffer(0);
	frame.state = 0;

	// Continue parsing if more data available
	if (frame.data.length >= 2) {
		setImmediate(ws.parse, connection, frame);
	}
};

// Prepare the handshake hash
ws.prepareHandshake = function (connection) {

	var host = connection.parent,
		key = connection.key,
		parent = host.parent;

	// Generate the base64 WS response key
	utils.generateHash(key + utils.ws.guid, 'base64', function (handshake) {

		var config = parent.conf.session,
			protocols = connection.protocols.join(', ');

		// Prepare the connection head
		connection.head += 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n';
		connection.head += 'Connection: Upgrade\r\n';
		connection.head += 'Upgrade: WebSocket\r\n';
		connection.head += 'Origin: ' + connection.headers.origin + '\r\n';
		connection.head += 'Sec-WebSocket-Accept: ' + handshake + '\r\n';

		// Add the connection subprotocols to the connection head
		if (protocols) {
			connection.head += 'Sec-Websocket-Protocol: ' + protocols + '\r\n';
		}

		// Prepare session
		if (config.enabled) {
			utils.getSession(parent, connection, ws.setSession);
		} else {
			ws.connectionProcess(connection);
		}
	});
};

// Make the WS handshake
ws.connectionProcess = function (connection) {

	var frame = {},
		host = connection.parent,
		parent = host.parent,
		ping = new Buffer([137, 0]);

	// Prepare the frame object
	frame.data = new Buffer(0);
	frame.index = 0;
	frame.limit = host.conf.limit;
	frame.message = new Buffer(0);
	frame.state = 0;

	// Process readable and close events and write connection HTTP head
	connection.socket.on('readable', function () {

		// Parse the received data
		ws.parse(connection, frame, this.read());

		// Clear the previous timer and create a new timeout for ping frames
		clearTimeout(connection.timer);
		connection.timer = setTimeout(function () {
			connection.socket.write(ping);
		}, 25000);
	}).on('close', function () {

		var index = host.connections.indexOf(connection);

		// Unbind the connection from its channels
		connection.channels.forEach(function (channel) {
			channel.unbind(connection);
		});

		// Remove the connection and its timer
		host.connections.splice(index, 1);
		clearTimeout(connection.timer);
		connection.emit('close');
	}).write(connection.head + '\r\n');

	// Execute user defined code for the WS host
	domain.create().on('error', function (error) {

		// Emit the error to the host if it has any error listeners
		if (host.listeners('error').length) {
			host.emit('error', error);
		} else {
			console.error('\n' + error.stack + '\n');
		}

		// Destroy the connection socket
		connection.socket.destroy();
	}).run(function () {

		// Log the new connection
		if (parent.logger.callbak) {
			utils.log(parent, connection);
		}

		// Call the connection listener, write ping frame and set time to live
		host.listener(connection);
		connection.socket.write(ping);
		connection.socket.setTimeout(30000);
	});
};

// Set the session cookies for WS requests
ws.setSession = function (connection, session) {

	var config = null,
		expires = 0,
		host = connection.parent,
		parent = host.parent;

	// Prepare expiration time for the session cookies
	config = parent.conf.session;
	expires = utils.utc(config.timeout);

	// Add the session cookies to the connection head
	connection.head += 'Set-Cookie: _session=' + session.id + ';';
	connection.head += 'expires=' + expires + ';httponly\r\n';
	connection.head += 'Set-Cookie: _hash=' + session.hash + ';';
	connection.head += 'expires=' + expires + ';httponly\r\n';

	// Link the session container to the connection
	connection.session = session.container;

	// Write the session to the store and remove its reference
	connection.on('close', function () {
		parent.conf.session.store.set(session.id, {
			id: session.id,
			hash: session.hash,
			expire: config.timeout + Date.now(),
			container: connection.session
		}, function () {
			connection.session = null;
		});
	});

	// Continue to process the request
	ws.connectionProcess(connection);
};

// Unmask the WS data
ws.unmasking = function (connection, frame) {

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

		// Loop through the data and apply xor operation
		while (index--) {
			frame.data[index] ^= frame.mask[index % 4];
		}

		// Concatenate payload data to the message
		data = frame.data.slice(0, size);
		length = frame.message.length + size;
		frame.message = Buffer.concat([frame.message, data], length);

		// Cut off the read data
		frame.data = frame.data.slice(size);
		frame.length -= size;

		// Parse message or unmask more data
		if (frame.fin && !frame.length) {
			ws.parseMessage(connection, frame);
		} else {
			setImmediate(ws.unmasking, connection, frame);
		}
	}
};