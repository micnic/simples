'use strict';

const AbstractConnection = require('simples/lib/abstract-connection');
const Config = require('simples/lib/utils/config');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const WSSender = require('simples/lib/utils/ws-sender');
const Frame = require('simples/lib/ws/frame');

const defaultLogFormat = '%short-date %time %protocol %href';
const normalWSCloseCode = 1000; // Code for normal WS close

class WSConnection extends AbstractConnection {

	/**
	 * WSConnection constructor
	 * @param {WSHost} host
	 * @param {string} location
	 * @param {IncomingMessage} request
	 */
	constructor(host, location, request) {

		let protocols = [];

		super(host._parent, location, request);

		// Prepare connection subprotocols
		if (request.headers['sec-websocket-protocol']) {

			const protocolHeader = request.headers['sec-websocket-protocol'];

			// Extract the subprotocols from the header
			protocols = protocolHeader.split(/\s*,\s*/);
		}

		// Define WS connection public properties
		this.protocols = protocols;

		// Define WS connection private properties
		this._advanced = host._options.advanced;
		this._channels = new Set();
		this._host = host;
		this._status = normalWSCloseCode;
		this._timer = null;

		// Make it possible to bind to more than 10 channels
		this.setMaxListeners(0);
	}

	/**
	 * Flush method implementation
	 * @param {Callback} callback
	 */
	async _flush(callback) {

		// Push the close frame
		this.push(Frame.close(this._status, false));

		// Save session to store if it is enabled and end the connection
		if (Config.isEnabled(this._router._options.session.enabled, this)) {

			// Try to save the session
			try {
				await this.session.save();
			} catch (error) {
				ErrorEmitter.emit(this._router, error);
			}

			// End the connection
			callback();
		} else {
			callback();
		}
	}

	/**
	 * Transform method implementation
	 * @param {string|Buffer} chunk
	 * @param {string} encoding
	 * @param {Callback} callback
	 */
	_transform(chunk, encoding, callback) {

		// Wrap the received chunk of data and push it to the stream
		Frame.wrap(chunk, false, (data) => {
			this.push(data);
		});

		// End current transform
		callback();
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
	 * Log data
	 * @param {string} format
	 * @param {Tokens} tokens
	 * @param {StringCallback} logger
	 */
	log(format, tokens, logger) {

		const args = {
			format: defaultLogFormat,
			logger: null,
			tokens: {}
		};

		if (typeof format === 'string') {
			args.format = format;

			if (typeof tokens === 'object') {
				args.tokens = tokens;

				if (typeof logger === 'function') {
					args.logger = logger;
				}
			} else if (typeof tokens === 'function') {
				args.logger = tokens;
			}
		} else if (typeof format === 'object') {
			args.tokens = format;

			if (typeof tokens === 'function') {
				args.logger = tokens;
			}
		} else if (typeof format === 'function') {
			args.logger = format;
		}

		super.log(args.format, args.tokens, args.logger);
	}

	/**
	 * Send data to the client
	 * @param {string} event
	 * @param {*} data
	 * @param {DataCallback<*>} callback
	 */
	send(event, data, callback) {
		WSSender.send(this, event, data, callback);
	}
}

module.exports = WSConnection;