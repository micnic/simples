'use strict';

const crypto = require('crypto');
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

class WSUtils {

	// Process WS requests
	static connectionListener(wsHost, location, request) {

		const connection = new WSConnection(wsHost, location, request);

		// Check if the request is valid
		if (WSUtils.validateConnection(connection)) {
			wsHost.connections.add(connection);
			WSUtils.prepareHandshake(connection);
		}
	}

	// Generate a WS handshake from the provided key
	static getHandshake(key) {

		return crypto.Hash('sha1').update(key + wsGuid).digest('base64');
	}

	// Prepare the handshake hash
	static prepareHandshake(connection) {

		const { headers } = connection;
		const handshake = WSUtils.getHandshake(headers['sec-websocket-key']);
		const router = connection._host._parent;
		const protocols = connection.protocols.join(', ');
		const options = router._options.session;

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
		if (Config.isEnabled(options.enabled, connection)) {

			// Get the session and populate the cookie
			Session.for(connection).then((session) => {

				const expires = TimeFormatter.utcFormat(session.timeout);

				// Add the session cookies to the connection head
				head += `Set-Cookie: _session=${session.id};`;
				head += `expires=${expires};httponly\r\n`;

				// Prepare connection for receiving data
				WSUtils.setupConnection(connection, head);
			}).catch((error) => {
				ErrorEmitter.emit(router, error);
			});
		} else {
			WSUtils.setupConnection(connection, head);
		}
	}

	// Prepare the connection for receiving and sending process
	static processConnection(connection, client) {

		const { socket } = connection;

		let limit = 0;

		// Check for server-side connection to define limit and reset
		if (!client) {

			// Get the limit for server-side connection
			limit = connection._host._options.limit;

			// Reset connection timeout when any data is received via the socket
			socket.on('data', () => {
				WSUtils.resetTimeout(connection);
			});
		}

		const parser = new WSParser(limit, client);

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
	}

	// Reset connection timeout
	static resetTimeout(connection) {

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
	}

	// Prepare WS connection for further data processing
	static setupConnection(connection, head) {

		const host = connection._host;
		const { socket } = connection;

		// Write the connection HTTP head
		socket.write(`${head}\r\n`);

		// Set connection timeout
		socket.setTimeout(host._options.timeout);

		// Set the connection timer to write the first ping frame before timeout
		WSUtils.resetTimeout(connection);

		// Start processing the server WS connection
		WSUtils.processConnection(connection, false);

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
	}

	// Validate the server WS connection
	static validateConnection(connection) {

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
			connection.destroy();
		}

		return result;
	}
}

module.exports = WSUtils;