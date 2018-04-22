'use strict';

const ClientRequest = require('simples/lib/client/request');
const Random = require('simples/lib/utils/random');
const WsFormatter = require('simples/lib/utils/ws-formatter');
const WsFrame = require('simples/lib/ws/frame');
const WsUtils = require('simples/lib/utils/ws-utils');

const { Transform } = require('stream');

const {
	handshakeKeyLength,
	normalWsCloseCode
} = require('simples/lib/utils/constants');

class ClientConnection extends Transform {

	constructor(location, advanced, options) {

		const request = ClientRequest.create('get', location, options);
		const wshs = WsUtils.getHandshake(options.headers['Sec-Websocket-Key']);

		super();

		// Define public client connection properties
		this.data = {};

		// Define private client connection properties
		this._advanced = advanced;
		this._options = options;
		this._socket = null;
		this._status = normalWsCloseCode;

		// Make the HTTP request
		request.on('error', (error) => {
			this.emit('error', error);
		}).once('response', () => {
			this.emit('error', Error('Request not upgraded'));
		}).once('upgrade', (response, socket) => {

			// Check if the response is valid
			if (ClientConnection.validate(this, response, wshs)) {

				// Bind the socket to the connection and emit open event
				this._socket = socket;
				this.emit('open');

				// Listen for connection socket errors
				socket.on('error', (error) => {
					this.emit('error', error);
				});

				// Start processing the client WS connection
				WsUtils.processConnection(this, true);
			}
		});
	}

	// Flush method implementation
	_flush(callback) {

		// Check if the connection is open and push the close frame
		if (this._socket) {
			this.push(WsFrame.close(this._status, true));
			callback(null);
		} else {
			this.once('open', () => {
				this.push(WsFrame.close(this._status, true));
				callback(null);
			});
		}
	}

	// Transform method implementation
	_transform(chunk, encoding, callback) {

		// Check if the connection is open to wrap WS data
		if (this._socket) {
			WsFrame.wrap(chunk, true, (data) => {
				this.push(data);
			});
			callback(null);
		} else {
			this.once('open', () => {
				WsFrame.wrap(chunk, true, (data) => {
					this.push(data);
				});
				callback(null);
			});
		}
	}

	// Close the connection and set a close status code if needed
	close(code, callback) {
		WsUtils.closeConnection(this, code, callback);
	}

	// Destroy the connection socket
	destroy() {

		// Check if there is a socket bound
		if (this._socket) {
			this._socket.destroy();
		}
	}

	// Send data to the server
	send(event, data, callback) {

		// Write formatted message to the connection
		this.write(WsFormatter.format(this._advanced, event, data));

		// Listen for event response in advanced mode if callback provided
		if (this._advanced && typeof callback === 'function') {
			this.once(event, callback);
		}
	}

	// Client connection factory method
	static create(location, advanced, options) {

		// Make mode and options parameters optional
		if (advanced && typeof advanced === 'object') {
			options = advanced;
			advanced = false;
		} else if (typeof advanced !== 'boolean') {
			advanced = false;
			options = {};
		}

		// Set the HTTP protocol in the location before making the request
		location = location.replace(/^ws/, 'http');

		// Copy options object to prevent mutation in external object
		options = Object.assign({}, options);

		// Set WebSocket specific HTTP headers
		options.headers = Object.assign({}, options.headers, {
			'Connection': 'Upgrade',
			'Sec-Websocket-Key': Random.randomBase64(handshakeKeyLength),
			'Sec-Websocket-Version': '13',
			'Upgrade': 'websocket'
		});

		return new ClientConnection(location, advanced, options);
	}

	// Validate the client WS connection
	static validate(connection, response, wshs) {

		const headers = response.headers;

		let error = '';
		let result = true;

		// Check for valid response headers
		if (headers.upgrade.toLowerCase() !== 'websocket') {
			error = 'Invalid upgrade header';
		} else if (!headers['sec-websocket-accept']) {
			error = 'No handshake provided';
		} else if (headers['sec-websocket-accept'] !== wshs) {
			error = 'Invalid handshake provided';
		}

		// Check for errors to invalidate the result
		if (error) {
			result = false;
			connection.emit('error', Error(error));
			response.connection.destroy();
		}

		return result;
	}
}

module.exports = ClientConnection;