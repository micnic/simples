'use strict';

var domain = require('domain'),
	url = require('url'),
	utils = require('simples/utils/utils');

// WS namespace
var ws = exports;

// Link to the WS connection prototype constructor
ws.connection = require('simples/lib/ws/connection');

// Link to the WS host prototype constructor
ws.host = require('simples/lib/ws/host');

// Link to the WS parser prototype constructor
ws.parser = require('simples/lib/parsers/ws');

// The WebSocket GUID
ws.guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Close frame header buffer
ws.close = new Buffer([136, 0]);

// Ping frame header buffer
ws.ping = new Buffer([137, 0]);

// Pong frame header buffer
ws.pong = new Buffer([138, 0]);

// Listener for WS requests
ws.connectionListener = function (host, request) {

	var connection = new ws.connection(host, request),
		error = '';

	// Validate client request
	if (!/^websocket$/i.test(connection.headers.upgrade)) {
		error = 'Invalid upgrade header';
	} else if (!connection.key) {
		error = 'No WebSocket handshake key';
	} else if (connection.headers['sec-websocket-version'] !== '13') {
		error = 'Unsupported WebSocket version';
	} else if (!utils.accepts(connection, host.options.origins)) {
		error = 'WebSocket origin not accepted';
	}

	// Check if any errors appeared and continue connection processing
	if (error) {

		// Emit safely the error to the host
		utils.emitError(host, new Error(error));

		// Destroy the connection
		connection.destroy();
	} else {
		host.connections.push(connection);
		ws.prepareHandshake(connection);
	}
};

// Generate default config for WS hosts
ws.defaultConfig = function () {

	return {
		limit: 1048576, // bytes, by default 1 MB
		mode: 'text', // can be 'binary', 'text' or 'object'
		origins: []
	};
};

// Prepare frame header
ws.frameHeader = function (fin, opcode, length) {

	var header = new Buffer(2);

	// Use 4 bytes header for length greater than 125 bytes
	if (length > 125) {
		header = new Buffer(4);
	}

	// Set the fin flag and the opcode in the first byte
	header[0] = 128 & fin << 7 | opcode;

	// Set the payload length
	if (length < 126) {
		header[1] = length;
	} else {
		header[1] = 126;
		header[2] = 255 & length >> 8;
		header[3] = 255 & length;
	}

	return header;
};

// Wrap data in WS frames
ws.frameWrap = function (header, data, masked) {

	var frame = new Buffer(header.length + data.length + masked * 4),
		mask = null;

	// Add the header to the frame buffer
	header.copy(frame);

	// Check for masked frame
	if (masked) {

		// Set the masked flag
		frame[1] |= 128;

		// Create the masking key and copy it to the frame buffer
		mask = utils.randomBytes(4);
		mask.copy(frame, header.length);

		// Add the data to the frame buffer
		data.copy(frame, header.length + 4);

		// Apply the masking key on the data bytes
		utils.xor(frame.slice(header.length + 4), mask);
	} else {
		data.copy(frame, header.length);
	}

	return frame;
};

// Generate a WS handshake from the provided key
ws.getHandshake = function (key, encoding, callback) {
	utils.generateHash(key + ws.guid, encoding, callback);
};

// Get the WS host if it exists from the HTTP host
ws.getHost = function (server, request) {

	var hostname = url.parse(request.url).pathname;

	return utils.http.getHost(server, request).routes.ws[hostname];
};

// Prepare the handshake hash
ws.prepareHandshake = function (connection) {

	var host = connection.parent,
		parent = host.parent;

	// Generate the base64 WS response key
	ws.getHandshake(connection.key, 'base64', function (handshake) {

		var config = parent.options.session,
			protocols = connection.protocols.join(', ');

		// Prepare the connection head
		connection.head += 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n';
		connection.head += 'Connection: Upgrade\r\n';
		connection.head += 'Upgrade: WebSocket\r\n';
		connection.head += 'Sec-WebSocket-Accept: ' + handshake + '\r\n';

		// Add the connection subprotocols to the connection head
		if (protocols) {
			connection.head += 'Sec-Websocket-Protocol: ' + protocols + '\r\n';
		}

		// Check if the origin was provided
		if (connection.headers.origin) {
			connection.head += 'Origin: ' + connection.headers.origin + '\r\n';
		}

		// Prepare session
		if (config.enabled) {
			utils.getSession(parent, connection, ws.setSession);
		} else {
			ws.connectionProcess(connection);
		}
	});
};

// Prepare the connection for receiving and sending process
ws.connectionProcess = function (connection) {

	var host = connection.parent,
		parser = new ws.parser(0, false);

	ws.processFrames(connection, parser);
	connection.pipe(connection.socket).pipe(parser);

	// Listen for connection socket events
	connection.socket.on('readable', function () {

		// Clear the previous timer and create a new timeout for ping frames
		clearTimeout(connection.timer);
		connection.timer = setTimeout(function () {
			connection.socket.write(ws.ping);
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
	});

	// Execute user defined code for the WS host
	domain.create().on('error', function (error) {

		// Emit safely the error to the host
		utils.emitError(host, error);

		// Destroy the connection
		connection.destroy();
	}).run(function () {
		connection.socket.write(connection.head + '\r\n');
		connection.socket.write(ws.ping);
		connection.socket.setTimeout(30000);
		host.listener(connection);
	});
};

// Merge frames to messages and emit them to the connection
ws.processFrames = function (connection, parser) {

	var message = null,
		pong = ws.frameWrap(ws.pong, new Buffer(0), true);

	// Add payload data to the message for long messages
	function concatenatePayload(data) {

		var length = message.data.length + data.length;

		// Add the data to the message
		message.data = Buffer.concat([message.data, data], length);
	}

	// Create the message based on the first frame in the sequence
	function createMessage(frame) {

		// Create the message object and add data to it
		message = {
			data: frame.data
		};

		// Set the message type based on the frame opcode
		if (frame.opcode === 1) {
			message.type = 'text';
		} else {
			message.type = 'binary';
		}
	}

	// Emit the message to the connection
	function emitMessage() {

		// Stringify message data
		if (message.type === 'text') {
			message.data = message.data.toString();
		}

		// Emit the message based on the connection mode
		if (connection.mode === 'object') {
			try {
				message = JSON.parse(message.data);
				connection.emit(message.event, message.data);
			} catch (error) {
				connection.emit('error', error);
			}
		} else {
			connection.emit('message', message);
		}
	}

	// Listen for parser events
	parser.on('error', function (error) {
		connection.emit('error', error);
	}).on('frame', function (frame) {
		if (frame.opcode === 8) {
			connection.end();
		} else if (frame.opcode === 9) {
			connection.socket.write(pong);
		} else if (frame.opcode !== 10) {

			// Prepare the message for emitting
			if (frame.opcode === 0) {
				concatenatePayload(frame.data);
			} else {
				createMessage(frame);
			}

			// Check if it is the last frame in the sequence
			if (frame.fin) {
				emitMessage();
			}
		}
	});
};

// Set the session cookies for WS requests
ws.setSession = function (connection, session) {

	var config = null,
		expires = 0,
		host = connection.parent,
		parent = host.parent;

	// Prepare expiration time for the session cookies
	config = parent.options.session;
	expires = utils.utc(config.timeout * 1000);

	// Add the session cookies to the connection head
	connection.head += 'Set-Cookie: _session=' + session.id + ';';
	connection.head += 'expires=' + expires + ';httponly\r\n';
	connection.head += 'Set-Cookie: _hash=' + session.hash + ';';
	connection.head += 'expires=' + expires + ';httponly\r\n';

	// Link the session container to the connection
	connection.session = session.container;

	// Write the session to the store and remove its reference
	connection.on('close', function () {
		utils.setSession(parent, connection, session);
	});

	// Continue to process the request
	ws.connectionProcess(connection);
};