'use strict';

const { Hash } = require('crypto');
const WSParser = require('simples/lib/parsers/ws-parser');
const Session = require('simples/lib/session/session');
const Config = require('simples/lib/utils/config');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const TimeFormatter = require('simples/lib/utils/time-formatter');
const WSConnection = require('simples/lib/ws/connection');
const Frame = require('simples/lib/ws/frame');

const byte = 8; // Bits in one byte
const closeCodeSize = 2; // Bytes reserved for code in close frame
const closeFrameOpcode = 8; // Opcode for close frame
const minTimeout = 2000; // Two seconds, minimal timeout for a WS connection
const normalWSCloseCode = 1000; // Code for normal WS close
const pingFrameOpcode = 0x09; // Opcode for ping frame
const protocolErrorCode = 1002; // Code for protocol errors
const second = 1000; // Milliseconds in one second
const wsGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'; // RFC6455 WS GUID

/**
 * Write a bad request head to the socket and end it
 * @param {Socket} socket
 */
const badRequest = (socket) => {
	socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
};

/**
 * Generate a WS handshake from the provided key
 * @param {string} key
 * @returns {string}
 */
const getHandshake = (key) => {

	return Hash('sha1').update(key + wsGuid).digest('base64');
};

/**
 * Reset connection timeout
 * @param {WSConnection} connection
 */
const resetTimeout = (connection) => {

	const { timeout } = connection._host._options;

	// Check for a valid timeout of minimum 2 seconds
	if (timeout >= minTimeout) {

		// Reset the current timer
		clearTimeout(connection._timer);

		// Set a new timer
		connection._timer = setTimeout(() => {
			connection.socket.write(Frame.ping());
		}, timeout - second).unref();
	}
};

/**
 * Prepare the connection for receiving and sending process
 * @param {WSConnection} connection
 * @param {boolean} client
 */
const processConnection = (connection, client) => {

	const { _host: host, socket } = connection;

	let limit = 0;

	// Check for server-side connection to define limit and reset
	if (!client) {

		// Get the limit for server-side connection
		limit = host._options.limit;

		// Reset connection timeout when any data is received via the socket
		socket.on('data', () => {
			resetTimeout(connection);
		});
	}

	const parser = new WSParser(client, limit, host._options.validation);

	// Pipe the connection to the net socket and the parser
	// In Node 10+ use stream.pipeline()
	connection.pipe(socket).pipe(parser);

	// Listen for parser events
	parser.on('error', (error) => {
		ErrorEmitter.emit(connection, error);
		connection.destroy();
	}).on('control', (frame) => {
		if (frame.opcode === closeFrameOpcode) {

			let code = normalWSCloseCode;

			// Try to extract the status code from the received close frame
			if (frame.length) {
				if (frame.length >= closeCodeSize) {
					code = (frame.data[0] << byte) + frame.data[1];
				} else {
					code = protocolErrorCode;
				}
			}

			// Close the connection
			connection.close(code);
		} else if (frame.opcode === pingFrameOpcode) {
			socket.write(Frame.pong(frame, client));
		}
	}).on('message', (message) => {
		if (connection._advanced) {
			try {
				const { event, data } = JSON.parse(message.data);

				// Emit message event and message data
				connection.emit(event, data);
			} catch (error) {

				// Safely emit the error to the connection
				ErrorEmitter.emit(connection, error);

				// In case of error emit as simple message
				connection.emit('message', message);
			}
		} else {
			connection.emit('message', message);
		}
	});
};

/**
 * Prepare WS connection for further data processing
 * @param {WSConnection} connection
 * @param {string} head
 */
const setupConnection = (connection, head) => {

	const host = connection._host;
	const { socket } = connection;

	// Write the connection HTTP head
	socket.write(`${head}\r\n`);

	// Set connection timeout
	socket.setTimeout(host._options.timeout);

	// Set the connection timer to write the first ping frame before timeout
	resetTimeout(connection);

	// Start processing the server WS connection
	processConnection(connection, false);

	// Emit safely any error to the host
	socket.on('error', (error) => {
		ErrorEmitter.emit(host, error);
	});

	// Listen for connection socket close event
	// In Node 10+ use stream.finished()
	socket.on('close', () => {

		// Unbind the connection from its channels
		connection._channels.forEach((channel) => {
			channel.unbind(connection);
		});

		// Remove the connection and its timer
		host.connections.delete(connection);
		clearTimeout(connection._timer);
		connection.emit('close');
	});

	// Execute user defined code for the WS host
	try {
		host.listener(connection);
	} catch (error) {

		// Emit safely the error to the host
		ErrorEmitter.emit(host, error);

		// Destroy the connection
		connection.destroy();
	}
};

/**
 * Prepare the handshake hash
 * @param {WSConnection} connection
 */
const prepareHandshake = async (connection) => {

	const { headers } = connection;
	const handshake = getHandshake(headers['sec-websocket-key']);
	const router = connection._router;
	const protocols = connection.protocols.join(', ');
	const { enabled, store, timeout } = router._options.session;

	let head = 'HTTP/1.1 101 Switching Protocols\r\n';

	// Prepare the connection head
	head += 'Connection: Upgrade\r\n';
	head += 'Upgrade: WebSocket\r\n';
	head += `Sec-WebSocket-Accept: ${handshake}\r\n`;

	// Add the connection subprotocols to the connection head
	if (protocols) {
		head += `Sec-Websocket-Protocol: ${protocols}\r\n`;
	}

	// Check if the origin was provided
	if (headers.origin) {
		head += `Origin: ${headers.origin}\r\n`;
	}

	// Prepare session
	if (Config.isEnabled(enabled, connection)) {

		const expires = TimeFormatter.utcFormat(timeout);
		const id = connection.cookies._session;

		// Try to create the session, set the session cookie and start process
		try {

			const session = await Session.for(connection, store, id, timeout);

			// Add the session cookies to the connection head
			head += `Set-Cookie: _session=${session.id};expires=${expires}\r\n`;

			// Prepare connection for receiving data
			setupConnection(connection, head);
		} catch (error) {
			ErrorEmitter.emit(router, error);
		}
	} else {
		setupConnection(connection, head);
	}
};

/**
 * Validate the server WS connection
 * @param {WSConnection} connection
 * @returns {boolean}
 */
const validateConnection = (connection) => {

	const { headers } = connection;
	const host = connection._host;
	const { origins } = host._options;

	let error = '';
	let result = true;

	// Check for valid request headers
	if (!headers.upgrade || headers.upgrade.toLowerCase() !== 'websocket') {
		error = 'Invalid upgrade header';
	} else if (!headers['sec-websocket-key']) {
		error = 'No WebSocket handshake key';
	} else if (headers['sec-websocket-version'] !== '13') {
		error = 'Unsupported WebSocket version';
	} else if (!WSConnection.isAccepted(connection, origins)) {
		error = 'WebSocket origin not accepted';
	}

	// Check for errors to invalidate the result
	if (error) {
		result = false;
		ErrorEmitter.emit(host, Error(error));
		badRequest(connection.socket);
	}

	return result;
};

/**
 * Process WS requests
 * @param {WSHost} host
 * @param {URL} location
 * @param {IncomingMessage} request
 */
const wsRequestListener = (host, location, request) => {

	const connection = new WSConnection(host, location, request);

	// Check if the request is valid
	if (validateConnection(connection)) {
		host.connections.add(connection);
		prepareHandshake(connection);
	}
};

module.exports = {
	badRequest,
	wsRequestListener
};