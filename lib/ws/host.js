'use strict';

var utils = require('simples/utils/utils'),
	wsChannel = require('simples/lib/ws/channel');

// WS host prototype constructor
var host = function (parent, config, listener) {

	var conf = {};

	// Define properties for the WS host configuration
	conf.limit = 1048576;
	conf.raw = false;
	conf.protocols = [];

	// Define special properties for the WS host
	Object.defineProperties(this, {
		channels: {
			value: []
		},
		conf: {
			value: conf,
			writable: true
		},
		connections: {
			value: [],
			writable: true
		},
		listener: {
			value: listener,
			writable: true
		},
		parent: {
			value: parent,
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
	if (this.config.raw) {
		data = event;
		filter = data;
	}

	// Prepare clients
	if (typeof filter === 'function') {
		clients = this.connections.filter(filter);
	}

	// Send data to the clients
	if (this.config.raw) {
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

	var channel = null;

	// Validate name and select the channel
	if (typeof name === 'string') {

		// Create a new channel if it does not exist
		if (!this.channels[name]) {
			this.channels[name] = new wsChannel(this, name);
		}

		// Select the channel
		channel = this.channels[name];
	}

	// Add connections to the channel
	if (channel && typeof filter === 'function') {
		this.connections.filter(filter).forEach(function (connection) {
			channel.bind(connection);
		});
	}

	return channel;
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
	if (!config || typeof config !== 'object') {
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

// Close all connections and remove the WS host
host.prototype.destroy = function () {

	var that = this;

	// Find the host location and remove it
	Object.keys(this.parent.wsHosts).forEach(function (host) {
		if (that.parent.wsHosts[host] === that) {
			that.close();
			delete that.parent.wsHosts[host];
		}
	});
};

module.exports = host;