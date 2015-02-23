'use strict';

var utils = require('simples/utils/utils');

// WebSocket connection prototype constructor
var connection = function (host, request) {

	var protocols = [];

	// Call abstract connection in this context
	utils.connection.call(this, host, request);

	// Define private properties for WebSocket connection
	Object.defineProperties(this, {
		buffer: {
			value: new Buffer(0),
			writable: true
		},
		channels: {
			value: []
		},
		head: {
			value: '',
			writable: true
		},
		key: {
			value: request.headers['sec-websocket-key']
		},
		mode: {
			value: host.options.mode
		},
		timer: {
			value: null,
			writable: true
		},
		type: {
			value: host.options.type
		}
	});

	// Prepare connection subprotocols
	if (request.headers['sec-websocket-protocol']) {
		protocols = request.headers['sec-websocket-protocol'].split(/\s*,\s*/i);
	}

	// Create and populate connection members
	this.protocols = protocols;

	// Make it possible to bind to more than 10 channels
	this.setMaxListeners(0);
};

// Inherit from abstract connection
connection.prototype = Object.create(utils.connection.prototype, {
	constructor: {
		value: connection
	}
});

// Flush method implementation
connection.prototype._flush = function (callback) {

	// Push the close frame
	this.push(utils.ws.close);

	// End the connection
	callback();
};

// Transform method implementation
connection.prototype._transform = function (chunk, encoding, callback) {

	var that = this,
		opcode = 1;

	// Wrap chunks of data asychronously
	function wrap(data) {

		var header = null,
			wrapped = null;

		// Check the length of the data and split it in smaller chunks
		if (data.length > 65535) {
			header = utils.ws.frameHeader(false, opcode, 65535);
			wrapped = utils.ws.frameWrap(header, data.slice(0, 65535), false);
			that.push(wrapped);
			opcode = 0;
			setImmediate(wrap, data.slice(65535));
		} else {
			header = utils.ws.frameHeader(true, opcode, data.length);
			wrapped = utils.ws.frameWrap(header, data, false);
			that.push(wrapped);
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

// Render from the template engine
connection.prototype.render = function (event, source, imports) {

	var host = this.parent,
		tengine = host.parent.tengine;

	// Prepare data
	if (this.mode !== 'object') {
		source = event;
		imports = source;
	}

	// Prepare the imports and inject the connection object
	imports = utils.assign({
		connection: this
	}, imports);

	// Check from defined template engine and connection mode
	if (tengine) {
		if (this.mode === 'object') {
			this.send(event, tengine.render(source, imports));
		} else {
			this.send(tengine.render(source, imports));
		}
	} else {
		this.write('No template engine defined');
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