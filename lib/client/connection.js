'use strict';

const Request = require('simples/lib/client/request');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const Random = require('simples/lib/utils/random');
const WSSender = require('simples/lib/utils/ws-sender');
const {
	getHandshake,
	processConnection
} = require('simples/lib/utils/ws-utils');
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

		// Set connection properties
		this.headers = [];
		this.socket = null;
		this._advanced = advanced;
		this._status = normalWSCloseCode;

		// Init connection
		this.init(location.replace(/^ws/, 'http'), assign({}, options));
	}

	/**
	 * Init connection, make the HTTP request and process response
	 * @param {string} location
	 * @param {*} options
	 */
	async init(location, options) {

		const handshake = getHandshake(options.headers['Sec-Websocket-Key']);

		// Set WebSocket specific HTTP headers
		// TODO: use object spread in Node 10+
		options.headers = assign({}, options.headers, {
			'Connection': 'Upgrade',
			'Sec-Websocket-Key': Random.randomBase64(handshakeKeyLength),
			'Sec-Websocket-Version': '13',
			'Upgrade': 'websocket'
		});

		const response = await new Request(location, options).send();

		// Validate response
		if (ClientConnection.validate(this, response, handshake)) {

			// Set connection headers and socket
			this.headers = response.headers;
			this.socket = response.socket;

			// Listen for socket errors
			this.socket.on('error', (error) => {
				ErrorEmitter.emit(this, error);
			});

			// Emit open event
			this.emit('open');

			// Start processing the client WS connection
			processConnection(this, true);
		}
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
	 * @param {string} handshake
	 * @returns {boolean}
	 */
	static validate(connection, response, handshake) {

		const { headers } = response;

		let error = '';
		let result = true;

		// Check for valid response headers
		if (headers.upgrade.toLowerCase() !== 'websocket') {
			error = 'Invalid upgrade header';
		} else if (!headers['sec-websocket-accept']) {
			error = 'No handshake provided';
		} else if (headers['sec-websocket-accept'] !== handshake) {
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