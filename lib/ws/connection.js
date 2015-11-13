'use strict';

var utils = require('simples/utils/utils');

// WebSocket connection prototype constructor
var Connection = function (host, request) {

	var protocols = [];

	// Call abstract connection in this context
	utils.Connection.call(this, host, request);

	// Define private properties for WebSocket connection
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
Connection.prototype = Object.create(utils.Connection.prototype, {
	constructor: {
		value: Connection
	}
});

// Flush method implementation
Connection.prototype._flush = function (callback) {

	// Push the close frame
	this.push(utils.ws.close);

	// End the connection
	callback();
};

// Transform method implementation
Connection.prototype._transform = function (chunk, encoding, callback) {

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
Connection.prototype.render = function (event, source, imports) {

	var host = this.parent,
		engine = host.parent.tengine,
		that = this;

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
	if (engine) {
		if (this.mode === 'object') {
			if (engine.render.length === 3) {
				engine.render(source, imports, function (result) {
					that.send(event, result);
				});
			} else if (engine.render.length < 3) {
				this.send(event, engine.render(source, imports));
			}
		} else if (engine.render.length === 3) {
			engine.render(source, imports, function (result) {
				this.send(result);
			});
		} else if (engine.render.length < 3) {
			this.send(engine.render(source, imports));
		}
	} else {
		this.write('No template engine defined');
	}
};

// Send data to the client
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

	// Check if the data is not already a buffer
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