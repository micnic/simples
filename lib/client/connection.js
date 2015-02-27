'use strict';

var stream = require('stream'),
	utils = require('simples/utils/utils');

// WebSocket connection prototype constructor
var connection = function (client, location, mode) {

	var key = '',
		options = {},
		that = this;

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Define private properties for connection
	Object.defineProperties(this, {
		client: {
			value: client
		},
		data: {
			value: []
		},
		enabled: {
			value: false,
			writable: true
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

	// Generate the handshake key
	key = utils.randomBytes(16, 'base64');

	// Prepare the handshake
	utils.ws.getHandshake(key, 'base64', function (handshake) {

		// Check if the HTTP headers object is not defined
		if (typeof options.headers !== 'object') {
			options.headers = {};
		}

		// Set WebSocket specific HTTP headers
		options.headers.Connection = 'Upgrade';
		options.headers.Upgrade = 'websocket';
		options.headers['Sec-Websocket-Key'] = key;
		options.headers['Sec-Websocket-Version'] = '13';

		// Make the HTTP request
		client.get(location, options).on('error', function (error) {
			that.emit('error', error);
		}).on('response', function () {
			that.emit('error', new Error('Request not upgraded'));
		}).on('upgrade', function (response, socket) {

			var error = '',
				parser = new utils.ws.parser(0, true);

			// Validate server response
			if (!/^websocket$/i.test(response.headers.upgrade)) {
				error = 'Invalid upgrade header';
			} else if (!response.headers['sec-websocket-accept']) {
				error = 'No handshake provided';
			} else if (response.headers['sec-websocket-accept'] !== handshake) {
				error = 'Invalid handshake provided';
			}

			// Check if any errors appeared and open the connection
			if (error) {
				that.emit('error', new Error(error));
			} else {

				// The connection is now enabled
				that.enabled = true;

				// Write buffered data to the socket
				that.data.forEach(function (frame) {
					socket.write(frame);
				});

				// Bind the socket to the connection and emit open event
				that.socket = socket;
				that.emit('open');

				// Listen for connection socket errors
				socket.on('error', function (error) {
					that.emit('error', error);
				});

				// Listen for parsers
				parser.on('error', function (error) {
					that.emit('error', error);
				});

				utils.ws.processFrames(that, parser);

				// Make the pipe for connection - socket - parser
				that.pipe(socket).pipe(parser);
			}
		});
	});
};

// Inherit from stream.Transform
connection.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: connection
	}
});

// Flush method implementation
connection.prototype._flush = function (callback) {

	var close = utils.ws.frameWrap(utils.ws.close, new Buffer(0), true),
		that = this;

	// Check if the connection is open and push the close frame
	if (this.enabled) {
		this.push(close);
		callback();
	} else {
		this.on('open', function () {
			that.push(close);
			callback();
		});
	}
};

// Transform method implementation
connection.prototype._transform = function (chunk, encoding, callback) {

	var that = this,
		opcode = 1;

	// Push data to the stream stack
	function push(data) {
		if (that.enabled) {
			that.push(data);
		} else {
			that.data.push(data);
		}
	}

	// Wrap chunks of data asychronously
	function wrap(data) {

		var header = null,
			wrapped = null;

		// Check the length of the data and split it in smaller chunks
		if (data.length > 65535) {
			header = utils.ws.frameHeader(false, opcode, 65535);
			wrapped = utils.ws.frameWrap(header, data.slice(0, 65535), true);
			push(wrapped);
			opcode = 0;
			setImmediate(wrap, data.slice(65535));
		} else {
			header = utils.ws.frameHeader(true, opcode, data.length);
			wrapped = utils.ws.frameWrap(header, data, true);
			push(wrapped);
			callback();
		}
	}

	// Check for binary data
	if (this.mode === 'binary') {
		opcode = 2;
	}

	// Prepare data for sending
	wrap(chunk);
};

// Close the connection
connection.prototype.close = function (callback) {

	// Check for a callback function for the finish event
	if (typeof callback === 'function') {
		this.end(callback);
	} else {
		this.end();
	}
};

// Set additional options
connection.prototype.config = function (options) {

	// Set only the defined options
	utils.setOptions(this, options);

	return this;
};

// Destroy the connection socket
connection.prototype.destroy = function () {

	// Check if there is a socket bound
	if (this.socket) {
		this.socket.destroy();
	}
};

// Send data to the client
connection.prototype.send = function (event, data) {

	// Prepare data
	if (this.mode === 'object') {
		data = {
			event: event,
			data: data
		};
	} else {
		data = event;
	}

	// Data type, may be binary or text
	if (!Buffer.isBuffer(data)) {

		// Stringify data which is not string
		if (typeof data !== 'string') {
			data = JSON.stringify(data);
		}

		// Transform the data in a buffer
		data = new Buffer(data || 0);
	}

	// Write the data to the connection
	this.write(data);
};

module.exports = connection;