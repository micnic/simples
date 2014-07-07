'use strict';

var utils = require('simples/utils/utils'),
	channel = require('simples/lib/ws/channel');

// WS host prototype constructor
var host = function (location, config, listener) {

	// Define private properties for WS host
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
			value: listener,
			writable: true
		},
		location: {
			value: location
		},
		parent: {
			value: null,
			writable: true
		}
	});

	// Configure the WS host
	this.config(config, listener);
};

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

// Close all existing connections to the host
host.prototype.close = function () {

	// Iterate connections and close them
	this.connections.forEach(function (connection) {
		connection.close();
	});

	return this;
};

// Configure the WS host
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

// Remove the WS host
host.prototype.destroy = function () {

	var parent = this.parent;

	// Close all existing connection fist and then remove it
	this.close();
	delete parent.routes.ws[this.location];
};

module.exports = host;