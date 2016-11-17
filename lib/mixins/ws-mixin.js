'use strict';

var domain = require('domain'),
	HttpMixin = require('simples/lib/mixins/http-mixin'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	WsConnection = require('simples/lib/ws/connection'),
	WsParser = require('simples/lib/parsers/ws');

var WsMixin = {};

// The WebSocket GUID
WsMixin.guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Ping frame header buffer
WsMixin.ping = Buffer([137, 0]);

// Write the data to the connections and filter them if needed
WsMixin.broadcast = function (broadcaster, data, filter) {

	// Write the data to the connections and filter them if needed
	if (typeof filter === 'function') {
		broadcaster.connections.forEach(function (connection, index, array) {
			if (filter(connection, index, array)) {
				connection.write(data);
			}
		});
	} else {
		broadcaster.connections.forEach(function (connection) {
			connection.write(data);
		});
	}
};

WsMixin.getDynamicHost = function (host, name) {

	var routes = host.routes.dynamic.ws,
		index = 0,
		keys = Object.keys(routes),
		length = keys.length;

	while (index < length && !routes[keys[index]].pattern.test(name)) {
		index ++;
	}

	if (index < length) {
		return routes[keys[index]];
	}

	return null;
};

// Get the WS host if it exists from the HTTP host
WsMixin.getHost = function (server, request) {

	var host = HttpMixin.getHost(server, request),
		name = url.parse(request.url).pathname.substr(1);

	if (host.routes.fixed.ws[name]) {
		return host.routes.fixed.ws[name];
	} else {
		return WsMixin.getDynamicHost(host, name);
	}
};

// Generate a WS handshake from the provided key
WsMixin.getHandshake = function (key, encoding, callback) {
	utils.generateHash(key + WsMixin.guid, encoding, callback);
};

// Generate a WS pong frame
WsMixin.pong = function () {

	var frame = Buffer([138, 128, 0, 0, 0, 0]);

	// Generate masking key and add it to the close frame
	utils.randomBytes(4).copy(frame, 2);

	return frame;
};

// Prepare the connection for receiving and sending process
WsMixin.processConnection = function (connection, client) {

	var host = client ? null : connection.parent,
		message = null,
		mode = client? connection.mode : host.options.mode,
		parser = WsParser.create(client ? 0 : host.options.limit, client),
		timeout = client ? null : host.options.timeout;

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
			message.data = String(message.data);
		}

		// Emit the message based on the connection mode
		if (mode === 'object') {
			try {
				message = JSON.parse(message.data);
				connection.emit(message.event, message.data);
			} catch (error) {
				utils.emitError(connection, error);
			}
		} else {
			connection.emit('message', message);
		}

		// Reset message after emit
		message = null;
	}

	// Pipe the connection to the net socket and the parser
	connection.pipe(connection.socket).pipe(parser);

	// Listen for parser events
	parser.on('error', function (error) {
		utils.emitError(connection, error);
	}).on('frame', function (frame) {

		// Check for a valid timeout of minimum 2 seconds
		if (!client) {
			if (timeout >= 2000) {

				// Reset the current timer
				clearTimeout(connection.timer);

				// Set a new timer
				connection.timer = setTimeout(function () {
					connection.socket.write(WsMixin.ping);
				}, timeout - 1000);
			}
		}

		// Decide what to do based on the frame opcode
		if (frame.opcode === 8) {
			connection.end();
		} else if (frame.opcode === 9) {
			connection.socket.write(WsMixin.pong());
		} else if (frame.opcode !== 10) {

			// Prepare the message for emitting
			if (frame.opcode === 0) {
				if (message) {
					concatenatePayload(frame.data);
				} else {
					parser.state = -1;
					parser.emit('error', Error('Invalid continuation frame'));
				}
			} else if (message) {
				parser.state = -1;
				parser.emit('error', Error('Continuation frame expected'));
			} else {
				createMessage(frame);
			}

			// Check if it is the last frame in the sequence
			if (!parser.state !== -1 && frame.fin) {
				emitMessage();
			}
		}
	});

	if (!client) {

		// Listen for connection socket events
		connection.socket.on('close', function () {

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
			connection.socket.write(WsMixin.ping);
			connection.socket.setTimeout(timeout);
			host.listener(connection);
		});
	}
};

// Prepare the handshake hash
WsMixin.prepareHandshake = function (connection) {

	var host = connection.parent,
		parent = host.parent;

	// Generate the base64 WS response key
	WsMixin.getHandshake(connection.key, 'base64', function (handshake) {

		var config = parent.options.session,
			protocols = connection.protocols.join(', ');

		// Prepare the connection head
		connection.head += 'HTTP/1.1 101 Switching Protocols\r\n';
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
			utils.getSession(parent, connection, function (session) {

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
				WsMixin.processConnection(connection, false);
			});
		} else {
			WsMixin.processConnection(connection, false);
		}
	});
};

// Process WS requests
WsMixin.connectionListener = function (host, request) {

	var connection = WsConnection.create(host, request),
		headers = connection.headers,
		error = '';

	// Validate client request
	if (headers.upgrade.toLowerCase() !== 'websocket') {
		error = 'Invalid upgrade header';
	} else if (!connection.key) {
		error = 'No WebSocket handshake key';
	} else if (headers['sec-websocket-version'] !== '13') {
		error = 'Unsupported WebSocket version';
	} else if (!utils.accepts(connection, host.options.origins)) {
		error = 'WebSocket origin not accepted';
	}

	// Check if any errors appeared and continue connection processing
	if (error) {

		// Emit safely the error to the host
		utils.emitError(host, Error(error));

		// Destroy the connection
		connection.destroy();
	} else {
		host.connections.push(connection);
		WsMixin.prepareHandshake(connection);
	}
};

module.exports = WsMixin;