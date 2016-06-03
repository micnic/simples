'use strict';

var ClientRequest = require('simples/lib/client/request'),
	stream = require('stream'),
	utils = require('simples/utils/utils'),
	WsMixin = require('simples/lib/mixins/ws-mixin'),
	WsParser = require('simples/lib/parsers/ws'),
	WsWrapper = require('simples/lib/ws/wrapper');

// WebSocket connection prototype constructor
var ClientConnection = function (location, mode, options) {

	var key = utils.randomBytes(16, 'base64'),
		request = null,
		that = this;

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Define private properties for connection
	Object.defineProperties(this, {
		data: {
			value: {}
		},
		mode: {
			value: mode
		},
		options: {
			value: options
		},
		socket: {
			value: null,
			writable: true
		}
	});

	// Set the WebSocket protocol in the location
	location = location.replace(/^http/, 'ws');

	// Check if the HTTP headers object is not defined
	if (!options.headers || typeof options.headers !== 'object') {
		options.headers = {};
	}

	// Prepare the handshake
	WsMixin.getHandshake(key, 'base64', function (handshake) {

		// Set WebSocket specific HTTP headers
		options.headers = utils.assign({}, options.headers, {
			'Connection': 'Upgrade',
			'Upgrade': 'websocket',
			'Sec-Websocket-Key': key,
			'Sec-Websocket-Version': '13'
		});

		// Create the GET HTTP request to upgrade to WS protocol
		request = ClientRequest.create('get', location, options);

		// Make the HTTP request
		request.on('error', function (error) {
			that.emit('error', error);
		}).once('response', function () {
			that.emit('error', Error('Request not upgraded'));
		}).once('upgrade', function (response, socket) {

			var error = '',
				headers = response.headers,
				parser = WsParser.create(0, true);

			// Validate server response
			if (headers.upgrade.toLowerCase() !== 'websocket') {
				error = 'Invalid upgrade header';
			} else if (!headers['sec-websocket-accept']) {
				error = 'No handshake provided';
			} else if (headers['sec-websocket-accept'] !== handshake) {
				error = 'Invalid handshake provided';
			}

			// Check if any errors appeared and open the connection
			if (error) {
				that.emit('error', Error(error));
			} else {

				// Bind the socket to the connection and emit open event
				that.socket = socket;
				that.emit('open');

				// Listen for connection socket errors
				socket.on('error', function (error) {
					that.emit('error', error);
				});

				// Listen for parser errors
				parser.on('error', function (error) {
					that.emit('error', error);
				});

				WsMixin.processConnection(that, true);

				// Make the pipe for connection - socket - parser
				that.pipe(socket).pipe(parser);
			}
		});
	});
};

// Generate a client WS close frame
ClientConnection.close = function () {

	var frame = Buffer([136, 128, 0, 0, 0, 0]);

	// Generate masking key and add it to the close frame
	utils.randomBytes(4).copy(frame, 2);

	return frame;
};

// Client connection factory function
ClientConnection.create = function (location, mode, options) {

	return new ClientConnection(location, mode, options);
};

// Inherit from stream.Transform
ClientConnection.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: ClientConnection
	}
});

// Flush method implementation
ClientConnection.prototype._flush = function (callback) {

	var that = this;

	// Check if the connection is open and push the close frame
	if (this.socket) {
		this.push(ClientConnection.close());
		callback();
	} else {
		this.once('open', function () {
			that.push(ClientConnection.close());
			callback();
		});
	}
};

// Transform method implementation
ClientConnection.prototype._transform = function (chunk, encoding, callback) {

	var options = {};

	// Prepare options for wrapping WS data
	options.connection = this;
	options.masked = true;
	options.mode = this.mode;

	// Check if the connection is open to wrap WS data
	if (this.socket) {
		WsWrapper.wrap(options, chunk, callback);
	} else {
		this.once('open', function () {
			WsWrapper.wrap(options, chunk, callback);
		});
	}
};

// Close the connection
ClientConnection.prototype.close = function (callback) {

	// Check for a callback function for the finish event
	if (typeof callback === 'function') {
		this.end(callback);
	} else {
		this.end();
	}
};

// Destroy the connection socket
ClientConnection.prototype.destroy = function () {

	// Check if there is a socket bound
	if (this.socket) {
		this.socket.destroy();
	}
};

// Send data to the server
ClientConnection.prototype.send = function (event, data) {
	this.write(WsWrapper.format(this.mode, event, data));
};

module.exports = ClientConnection;