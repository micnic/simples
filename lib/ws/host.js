'use strict';

var channel = require('simples/lib/ws/channel'),
	events = require('events'),
	utils = require('simples/utils/utils');

// WebSocket host prototype constructor
var host = function (parent, location) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for WebSocket host
	Object.defineProperties(this, {
		channels: {
			value: {}
		},
		connections: {
			value: []
		},
		listener: {
			value: null,
			writable: true
		},
		location: {
			value: location
		},
		options: {
			value: utils.ws.defaultConfig()
		},
		parent: {
			value: parent
		}
	});
};

// Inherit from events.EventEmitter
host.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: host
	}
});

// Send data to all active clients or a part of them
host.prototype.broadcast = function (event, data, filter) {

	var clients = this.connections;

	// Apply filtering and send data
	if (this.options.mode === 'object') {

		// Check for filter function to apply
		if (typeof filter === 'function') {
			this.connections.forEach(function (connection, index, array) {
				if (filter(connection, index, array)) {
					connection.send(event, data);
				}
			});
		} else {
			this.connections.forEach(function (connection) {
				connection.send(event, data);
			});
		}

		// Emit broadcast event with the provided data
		this.emit('broadcast', event, data);
	} else {

		// Prepare arguments for non-object mode
		data = event;
		filter = data;

		// Check for filter function to apply
		if (typeof filter === 'function') {
			this.connections.forEach(function (connection, index, array) {
				if (filter(connection, index, array)) {
					connection.send(data);
				}
			});
		} else {
			clients.forEach(function (connection) {
				connection.send(data);
			});
		}

		// Emit broadcast event with the provided data
		this.emit('broadcast', data);
	}

	return this;
};

// Returns a channel for grouping connections
host.prototype.channel = function (name, filter) {

	var that = this;

	// Validate name and select the channel
	if (typeof name === 'string') {

		// Create a new channel if it does not exist
		if (!this.channels[name]) {
			this.channels[name] = new channel(this, name);
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

// Configure the WebSocket host
host.prototype.config = function (config, listener) {

	// Make config parameter optional
	if (typeof config === 'function') {
		listener = config;
	}

	// Use an empty object if config is not an object
	if (!utils.isObject(config)) {
		config = {};
	}

	// Check the type of the connection listener
	if (typeof listener === 'function') {
		this.listener = listener;
	}

	// Copy the configuration object
	utils.copyConfig(this.options, utils.assign({}, config));

	return this;
};

// Remove the WebSocket host
host.prototype.destroy = function () {

	var parent = this.parent;

	// Close all existing connections
	this.connections.forEach(function (connection) {
		connection.destroy();
	});

	// Remove the WebSocket host from its parent
	delete parent.routes.ws[this.location];
};

module.exports = host;