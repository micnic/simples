'use strict';

var Request = require('simples/lib/client/request'),
	stream = require('stream'),
	utils = require('simples/utils/utils');

// WebSocket connection prototype constructor
var Connection = function (location, mode, options) {

	var key = '',
		request = null,
		that = this;

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Define private properties for connection
	Object.defineProperties(this, {
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

	// Check if the HTTP headers object is not defined
	if (!options.headers || typeof options.headers !== 'object') {
		options.headers = {};
	}

	// Prepare the handshake
	utils.ws.getHandshake(key, 'base64', function (handshake) {

		// Set WebSocket specific HTTP headers
		options.headers = utils.assign({}, options.headers, {
			'Connection': 'Upgrade',
			'Upgrade': 'websocket',
			'Sec-Websocket-Key': key,
			'Sec-Websocket-Version': '13'
		});

		request = new Request('get', location, options);

		// Make the HTTP request
		request.on('error', function (error) {
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
Connection.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: Connection
	}
});

// Flush method implementation
Connection.prototype._flush = function (callback) {

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
Connection.prototype._transform = function (chunk, encoding, callback) {

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
Connection.prototype.close = function (callback) {

	// Check for a callback function for the finish event
	if (typeof callback === 'function') {
		this.end(callback);
	} else {
		this.end();
	}
};

// Destroy the connection socket
Connection.prototype.destroy = function () {

	// Check if there is a socket bound
	if (this.socket) {
		this.socket.destroy();
	}
};

// Send data
Connection.prototype.send = function (event, data) {

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

module.exports = Connection;