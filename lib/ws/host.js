'use strict';

var Channel = require('simples/lib/ws/channel'),
	events = require('events'),
	Route = require('simples/lib/route'),
	WsMixin = require('simples/lib/mixins/ws-mixin'),
	WsWrapper = require('simples/lib/ws/wrapper');

// WS host prototype constructor
var WsHost = function (parent, location, listener) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for WebSocket host
	Object.defineProperties(this, {
		channels: {
			value: {},
			enumerable: true
		},
		connections: {
			value: [],
			enumerable: true
		},
		options: {
			value: WsHost.defaultConfig()
		},
		parent: {
			value: parent
		}
	});

	// Call Route in this context
	Route.call(this, location, listener);
};

// WS host factory function
WsHost.create = function (parent, location) {

	return new WsHost(parent, location);
};

// Generate default config for WS hosts
WsHost.defaultConfig = function () {

	return {
		limit: 1048576, // bytes, by default 1 MB
		mode: 'text', // can be 'binary', 'text' or 'object'
		origins: [],
		timeout: 30000 // miliseconds, by default 30 seconds
	};
};

// Inherit from events.EventEmitter
WsHost.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: WsHost
	}
});

// Send data to all active connections or a part of them
WsHost.prototype.broadcast = function (event, data, filter) {

	var mode = this.options.mode;

	// Broadcast the formatted data
	WsMixin.broadcast(this, WsWrapper.format(mode, event, data), filter);

	// Emit broadcast event with the provided data
	if (mode === 'object') {
		this.emit('broadcast', event, data);
	} else {
		this.emit('broadcast', data);
	}

	return this;
};

// Returns a channel for grouping connections
WsHost.prototype.channel = function (name, filter) {

	var that = this;

	// Validate name and select the channel
	if (typeof name === 'string') {

		// Create a new channel if it does not exist
		if (!this.channels[name]) {
			this.channels[name] = Channel.create(this, name);
		}

		// Add connections to the channel
		if (typeof filter === 'function') {
			this.connections.forEach(function (connection, index, array) {
				if (filter(connection, index, array)) {
					that.channels[name].bind(connection);
				}
			});
		}
	}

	return this.channels[name];
};

// Configure the WS host
WsHost.prototype.config = function (options, listener) {

	// Make options parameter optional
	if (typeof options === 'function') {
		listener = options;
		options = {};
	}

	// Check the type of the connection listener
	if (typeof listener === 'function') {
		this.listener = listener;
	}

	// Set limit option if available
	if (typeof options.limit === 'number') {
		this.options.limit = options.limit;
	}

	// Set mode option if available
	if (typeof options.mode === 'string') {
		this.options.mode = options.mode;
	}

	// Set origins option if available
	if (Array.isArray(options.origins)) {
		this.options.origins = options.origins;
	}

	// Set timeout option if available
	if (typeof options.timeout === 'number') {
		this.options.timeout = options.timeout;
	}

	return this;
};

// Remove the WS host
WsHost.prototype.destroy = function () {

	var parent = this.parent,
		routes = parent.routes;

	// Close all existing connections
	this.connections.forEach(function (connection) {
		connection.destroy();
	});

	// Remove the WS host from its parent
	if (/\:|\*/.test(this.location)) {
		delete routes.dynamic.ws[this.location];
	} else {
		delete routes.fixed.ws[this.location];
	}
};

module.exports = WsHost;