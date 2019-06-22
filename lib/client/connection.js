'use strict';

const Request = require('simples/lib/client/request');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const Random = require('simples/lib/utils/random');
const WSSender = require('simples/lib/utils/ws-sender');
const WSUtils = require('simples/lib/utils/ws-utils');
const Frame = require('simples/lib/ws/frame');
const { Transform } = require('stream');

const { assign } = Object;

const handshakeKeyLength = 16; // Length of WS handshake key
const normalWSCloseCode = 1000; // Code for normal WS close

// Stream options to not decode strings
const stringStreamOptions = {
	decodeStrings: false
};

class ClientConnection extends Transform {

	/**
	 * ClientConnection constructor
	 * @param {string} location
	 * @param {boolean} advanced
	 * @param {*} options
	 */
	constructor(location, advanced, options) {
		super(stringStreamOptions);

		// Set the HTTP protocol in the location before making the request
		location = location.replace(/^ws/, 'http');

		// Copy options object to prevent mutation in external object
		// TODO: use object spread in Node 10+
		options = assign({}, options);

		// Set WebSocket specific HTTP headers
		// TODO: use object spread in Node 10+
		options.headers = assign({}, options.headers, {
			'Connection': 'Upgrade',
			'Sec-Websocket-Key': Random.randomBase64(handshakeKeyLength),
			'Sec-Websocket-Version': '13',
			'Upgrade': 'websocket'
		});

		const wshs = WSUtils.getHandshake(options.headers['Sec-Websocket-Key']);
		const request = new Request(location, options);

		this.headers = [];
		this.socket = null;
		this._advanced = advanced;
		this._status = normalWSCloseCode;

		request.send().then((response) => {

			if (ClientConnection.validate(this, response, wshs)) {

				this.headers = response.headers;
				this.socket = response.socket;

				this.socket.on('error', (error) => {
					ErrorEmitter.emit(this, error);
				});

				this.emit('open');

				// Start processing the client WS connection
				WSUtils.processConnection(this, true);
			}
		});
	}

	/**
	 * Flush method implementation
	 * @param {Callback} callback
	 */
	_flush(callback) {

		const data = Frame.close(this._status, true);

		// Check if the connection is open and push the close frame
		if (this.socket) {
			ClientConnection.pushData(this, data, callback);
		} else {
			this.once('open', () => {
				ClientConnection.pushData(this, data, callback);
			});
		}
	}

	/**
	 * Transform method implementation
	 * @param {string|Buffer} chunk
	 * @param {string} encoding
	 * @param {Callback} callback
	 */
	_transform(chunk, encoding, callback) {

		// Wrap data in WS frames
		Frame.wrap(chunk, true, (data) => {
			if (this.socket) {
				ClientConnection.pushData(this, data, callback);
			} else {
				this.once('open', () => {
					ClientConnection.pushData(this, data, callback);
				});
			}
		});
	}

	/**
	 * Close the connection and set a close status code if needed
	 * @param {number} code
	 * @param {Callback} callback
	 */
	close(code, callback) {
		WSSender.closeConnection(this, code, callback);
	}

	/**
	 * Destroy the connection socket
	 */
	destroy() {

		// Check if there is a socket bound
		if (this.socket) {
			this.socket.destroy();
		}
	}

	/**
	 * Send data to the server
	 * @param {string} event
	 * @param {*} data
	 * @param {DataCallback<*>} callback
	 */
	send(event, data, callback) {
		WSSender.send(this, event, data, callback);
	}

	/**
	 * Push current chunk of data to the stream
	 * @param {ClientConnection} connection
	 * @param {Buffer} data
	 * @param {Callback} callback
	 */
	static pushData(connection, data, callback) {
		connection.push(data);
		callback(null);
	}

	/**
	 * Validate the client WS connection
	 * @param {ClientConnection} connection
	 * @param {Response} response
	 * @param {string} wshs
	 * @returns {boolean}
	 */
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
			response.socket.destroy();
		}

		return result;
	}
}

module.exports = ClientConnection;