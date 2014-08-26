'use strict';

var events = require('events'),
	utils = require('simples/utils/utils'),
	channel = require('simples/lib/ws/channel');

// WebSocket host prototype constructor
var host = function (parent, location) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for WebSocket host
	Object.defineProperties(this, {
		channels: {
			value: []
		},
		conf: {
			value: utils.ws.defaultConfig()
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

	// Prepare data
	if (this.config.mode === 'raw') {
		data = event;
		filter = data;
	}

	// Prepare clients
	if (typeof filter === 'function') {
		clients = this.connections.filter(filter);
	}

	// Send data to the clients
	if (this.config.mode === 'raw') {
		clients.forEach(function (connection) {
			connection.send(data);
		});
	} else {
		clients.forEach(function (connection) {
			connection.send(event, data);
		});
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
	}

	// Add connections to the channel
	if (this.channels[name] && typeof filter === 'function') {
		this.connections.filter(filter).forEach(function (connection) {
			that.channels[name].bind(connection);
		});
	}

	return this.channels[name];
};

// Configure the WebSocket host
host.prototype.config = function (config, listener) {

	// Set config optional
	if (typeof config === 'function') {
		listener = config;
		config = {};
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
	utils.copyConfig(this.conf, config);

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