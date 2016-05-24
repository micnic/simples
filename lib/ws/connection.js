'use strict';

var AbstractConnection = require('simples/lib/abstract-connection'),
	utils = require('simples/utils/utils'),
	WsWrapper = require('simples/lib/ws/wrapper');

// WS connection prototype constructor
var WsConnection = function (host, request) {

	var protocols = [];

	// Call AbstractConnection in this context
	AbstractConnection.call(this, host, request);

	// Define private properties for WS connection
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
		protocols = request.headers['sec-websocket-protocol'].split(/\s*,\s*/);
	}

	// Create and populate connection members
	this.protocols = protocols;

	// Make it possible to bind to more than 10 channels
	this.setMaxListeners(0);
};

// Close frame
WsConnection.close = Buffer([136, 0]);

// WS connection factory function
WsConnection.create = function (host, request) {

	return new WsConnection(host, request);
};

// Inherit from AbstractConnection
WsConnection.prototype = Object.create(AbstractConnection.prototype, {
	constructor: {
		value: WsConnection
	}
});

// Flush method implementation
WsConnection.prototype._flush = function (callback) {

	// Push the close frame
	this.push(WsConnection.close);

	// End the connection
	callback();
};

// Transform method implementation
WsConnection.prototype._transform = function (chunk, encoding, callback) {

	var host = this.parent;

	// Wrap data in WS frames
	WsWrapper.wrap({
		connection: this,
		masked: false,
		mode: host.options.mode
	}, chunk, callback);
};

// Render from the template engine
WsConnection.prototype.render = function (event, source, imports) {

	var host = this.parent,
		engine = host.parent.tengine,
		mode = host.options.mode,
		that = this;

	// Prepare data
	if (mode !== 'object') {
		source = event;
		imports = source;
	}

	// Prepare the imports and inject the connection object
	imports = utils.assign({
		connection: this
	}, imports);

	// Check from defined template engine and WS mode
	if (engine) {
		if (mode === 'object') {
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
WsConnection.prototype.send = function (event, data) {

	var host = this.parent;

	// Write formatted data to the connection
	this.write(WsWrapper.format(host.options.mode, event, data));
};

module.exports = WsConnection;