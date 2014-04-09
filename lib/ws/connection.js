'use strict';

var utils = require('simples/utils/utils');

// WS connection prototype constructor
var connection = function (host, request) {

	var protocols = [];

	// Call abstract connection in this context
	utils.connection.call(this, host, request);

	// Define special properties for the WS connection
	Object.defineProperties(this, {
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
			value: host.conf.mode
		},
		timer: {
			value: null,
			writable: true
		},
		type: {
			value: host.conf.type
		}
	});

	// Prepare connection subprotocols
	if (request.headers['sec-websocket-protocol']) {
		protocols = request.headers['sec-websocket-protocol'].split(/\s*,\s*/);
	}

	// Create and populate connection members
	this.protocols = protocols;

	// Make it possible to bind to more than 10 channels
	this.setMaxListeners(0);
};

// Inherit from abstractConnection
connection.prototype = Object.create(utils.connection.prototype, {
	constructor: {
		value: connection
	}
});

// Flush method implementation
connection.prototype._flush = function (callback) {

	// Push ending frame
	this.push(new Buffer([136, 0]));
	callback();
};

// Transform method implementation
connection.prototype._transform = function (chunk, encoding, callback) {

	var header = new Buffer(0),
		length = chunk.length,
		queue = new Buffer(0),
		type = 1;

	// Check for binary data
	if (this.type === 'binary') {
		type = 2;
	}

	// Prepare data which is bigger that 16KB
	if (length > 65535) {

		// Prepare the first 64KB frame
		header = new Buffer([type, 126, 255, 255]);
		queue = utils.buffer(queue, header, chunk.slice(0, 65535), 65539);
		chunk = chunk.slice(65535);
		length = chunk.length;
		type = 0;

		// Prepare the next 64KB frames
		while (length > 65535) {
			header = new Buffer([0, 126, 255, 255]);
			length = queue.length + 65539;
			queue = utils.buffer(queue, header, chunk.slice(0, 65535), length);
			chunk = chunk.slice(65535);
			length = chunk.length;
		}
	}

	// Prepare the last frame or the only frame depending on its length
	if (length < 126) {
		header = new Buffer([128 | type, length]);
	} else {
		header = new Buffer([128 | type, 126, 255 & length >> 8, 255 & length]);
	}

	// Concatenate data and push it to the connection stream
	length = queue.length + header.length + chunk.length;
	queue = utils.buffer(queue, header, chunk, length);

	// Add the data to the stream stack
	this.push(queue);
	callback();
};

// Render from the template engine
connection.prototype.render = function (event, source, imports) {

	var host = this.parent,
		tengine = host.parent.tengine;

	// Prepare data
	if (this.mode === 'raw') {
		source = event;
		imports = source;
	}

	// Set imports as an empty object if it is not
	if (!imports || typeof imports !== 'object') {
		imports = {};
	}

	// Inject connection to imports
	imports.connection = this;

	// Check from raw or advanced mode
	if (!tengine) {
		console.error('\nsimpleS: No template engine defined\n');
		this.write('No template engine defined');
	} else if (this.mode === 'raw') {
		this.send(tengine.render(source, imports));
	} else {
		this.send(event, tengine.render(source, imports));
	}
};

// Send data to the client
connection.prototype.send = function (event, data) {

	// Prepare data
	if (this.mode === 'raw') {
		data = event;
	} else {
		data = {
			event: event,
			data: data,
			type: this.type
		};
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