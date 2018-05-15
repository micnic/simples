'use strict';

const AbstractConnection = require('simples/lib/abstract-connection');
const WsFrame = require('simples/lib/ws/frame');
const WsFormatter = require('simples/lib/utils/ws-formatter');

const { normalWsCloseCode } = require('simples/lib/utils/constants');

class WsConnection extends AbstractConnection {

	constructor(parentHost, location, request, advancedMode) {

		let protocols = [];

		super(location, request);

		// Prepare connection subprotocols
		if (request.headers['sec-websocket-protocol']) {

			const protocolHeader = request.headers['sec-websocket-protocol'];

			// Extract the subprotocols from the header
			protocols = protocolHeader.split(/\s*,\s*/);
		}

		// Define WS connection public properties
		this.protocols = protocols;

		// Define WS connection private properties
		this._advanced = advancedMode;
		this._channels = new Set();
		this._host = parentHost;
		this._status = normalWsCloseCode;
		this._timer = null;

		// Make it possible to bind to more than 10 channels
		this.setMaxListeners(0);
	}

	// Flush method implementation
	_flush(callback) {

		// Push the close frame
		this.push(WsFrame.close(this._status, false));

		// End the connection
		callback();
	}

	// Transform method implementation
	_transform(chunk, encoding, callback) {
		WsFrame.wrap(chunk, false, (data) => {
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

	// Send data to the client
	send(event, data, callback) {
		WsFormatter.send(this, event, data, callback);
	}

	// WS connection factory method
	static create(parentHost, location, request, advancedMode) {

		return new WsConnection(parentHost, location, request, advancedMode);
	}
}

module.exports = WsConnection;