'use strict';

const AbstractConnection = require('simples/lib/abstract-connection');
const Args = require('simples/lib/utils/args');
const WSFrame = require('simples/lib/ws/frame');
const WSFormatter = require('simples/lib/utils/ws-formatter');

const { normalWSCloseCode } = require('simples/lib/utils/constants');

const logTypes = [
	'string',
	'object',
	'function'
];

class WSConnection extends AbstractConnection {

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

	// Flush method implementation
	_flush(callback) {

		// Push the close frame
		this.push(WSFrame.close(this._status, false));

		// End the connection
		callback();
	}

	// Transform method implementation
	_transform(chunk, encoding, callback) {
		WSFrame.wrap(chunk, false, (data) => {
			this.push(data);
		});
		callback();
	}

	// Close the connection and set a close status code if needed
	close(code, callback) {

		// Make arguments optional
		if (typeof code === 'number') {

			// Set the close status of the connection
			this._status = code;

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
		this.end(callback);
	}

	// Log data
	log(format, tokens, logger) {

		// Make arguments optional
		[
			format,
			tokens,
			logger
		] = Args.getArgs(logTypes, format, tokens, logger);

		// Set default format
		if (!format) {
			format = '%short-date %time %protocol %href';
		}

		// Stringify buffer data
		if (Buffer.isBuffer(format)) {
			format = String(format);
		}

		// Stringify any other type of data
		if (typeof format !== 'string') {
			format = JSON.stringify(format);
		}

		super.log(format, tokens, logger);
	}

	// Send data to the client
	send(event, data, callback) {
		WSFormatter.send(this, event, data, callback);
	}

	// WS connection factory method
	static create(host, location, request) {

		return new WSConnection(host, location, request);
	}
}

module.exports = WSConnection;