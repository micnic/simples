'use strict';

const Config = require('simples/lib/utils/config');
const crypto = require('crypto');
const domain = require('domain');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const SessionUtils = require('simples/lib/utils/session-utils');
const TimeFormatter = require('simples/lib/utils/time-formatter');
const WSConnection = require('simples/lib/ws/connection');
const WSFrame = require('simples/lib/ws/frame');
const WSParser = require('simples/lib/parsers/ws-parser');

const {
	byte,
	closeFrameOpcode,
	minTimeout,
	normalWSCloseCode,
	pingFrameOpcode,
	protocolErrorCode,
	second,
	wsGuid
} = require('simples/lib/utils/constants');

class WSUtils {

	// Close the connection and set a close status code if needed
	static closeConnection(connection, code, callback) {

		// Make arguments optional
		if (typeof code === 'number') {

			// Set the close status of the connection
			connection.status = code;

			// Nullify callback value if it is not a function
			if (typeof callback !== 'function') {
				callback = null;
			}
		} else if (typeof code === 'function') {
			callback = code;
		} else {
			callback = null;
		}

		// End the connection and call the callback if needed
		connection.end(callback);
	}

	// Process WS requests
	static connectionListener(wsHost, location, request) {

		const connection = WSConnection.create(wsHost, location, request);

		// Check if the request is valid
		if (WSUtils.validateConnection(connection)) {
			wsHost.connections.add(connection);
			WSUtils.prepareHandshake(connection);
		}
	}

	// Generate a WS handshake from the provided key
	static getHandshake(connection) {

		const key = connection.headers['sec-websocket-key'];

		return crypto.Hash('sha1').update(key + wsGuid).digest('base64');
	}

	// Prepare the handshake hash
	static prepareHandshake(connection) {

		const handshake = WSUtils.getHandshake(connection);
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
		if (connection.headers.origin) {
			head += `Origin: ${connection.headers.origin}\r\n`;
		}

		// Prepare session
		if (Config.isEnabled(options.enabled, connection)) {

			const expires = TimeFormatter.utcFormat(options.timeout);

			// Get the session and populate the cookie
			SessionUtils.getSession(connection).then((session) => {

				// Add the session cookies to the connection head
				head += `Set-Cookie: _session=${session.id};`;
				head += `expires=${expires};httponly\r\n`;
				head += `Set-Cookie: _hash=${session.hash};`;
				head += `expires=${expires};httponly\r\n`;

				// Link the session container to the connection
				connection.session = session.container;

				// Write the session to the store and remove its reference
				connection.on('close', () => {
					SessionUtils.applySession(connection, session);
				});

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

		const socket = connection.socket;

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

		const parser = WSParser.create(limit, client);

		// Pipe the connection to the net socket and the parser
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
					if (frame.length > 1) {
						code = (frame.data[0] << byte) + frame.data[1];
					} else {
						code = protocolErrorCode;
					}
				}

				// Send the close frame
				socket.end(WSFrame.close(code, client));
			} else if (frame.opcode === pingFrameOpcode) {
				socket.write(WSFrame.pong(frame, client));
			}
		}).on('message', (message) => {
			if (connection._advanced) {
				try {
					message = JSON.parse(message.data);

				} catch (error) {
					ErrorEmitter.emit(connection, error);
				} finally {
					if (message) {
						connection.emit(message.event, message.data);
					} else {
						connection.emit('message', message);
					}
				}
			} else {
				connection.emit('message', message);
			}
		});
	}

	// Reset connection timeout
	static resetTimeout(connection) {

		const timeout = connection._host._options.timeout;

		// Check for a valid timeout of minimum 2 seconds
		if (timeout >= minTimeout) {

			// Reset the current timer
			clearTimeout(connection._timer);

			// Set a new timer
			connection._timer = setTimeout(() => {
				connection.socket.write(WSFrame.ping());
			}, timeout - second).unref();
		}
	}

	// Prepare WS connection for further data processing
	static setupConnection(connection, head) {

		const host = connection._host;
		const socket = connection.socket;

		// Write the connection HTTP head
		socket.write(`${head}\r\n`);

		// Set connection timeout
		socket.setTimeout(host._options.timeout);

		// Set the connection timer to write the first ping frame before timeout
		WSUtils.resetTimeout(connection);

		// Start processing the server WS connection
		WSUtils.processConnection(connection, false);

		// Listen for connection socket events
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
		domain.create().on('error', (error) => {

			// Emit safely the error to the host
			ErrorEmitter.emit(host, error);

			// Destroy the connection
			connection.destroy();
		}).run(() => {
			host.listener(connection);
		});
	}

	// Validate the server WS connection
	static validateConnection(connection) {

		const headers = connection.headers;
		const host = connection._host;
		const origins = host._options.origins;

		let error = '';
		let result = true;

		// Check for valid request headers
		if (headers.upgrade.toLowerCase() !== 'websocket') {
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