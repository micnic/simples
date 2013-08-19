'use strict';

var channel = require('./channel');

// WebSocket host prototype constructor
var host = function (location, config, callback) {

	// Define special properties for WebSocket host
	Object.defineProperties(this, {
		active: {
			value: false,
			writable: true
		},
		callback: {
			value: callback,
			writable: true
		},
		channels: {
			value: {}
		},
		config: {
			value: config,
			writable: true
		},
		connections : {
			value: [],
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

	// Activate the WebSocket host
	this.open();
};

// Send data to all active clients or a part of them
host.prototype.broadcast = function (event, data, filter) {

	var clients;

	// Prepare data
	if (this.config.raw) {
		data = event;
		filter = data;
	}

	// Prepare clients
	if (filter) {
		clients = this.connections.filter(filter);
	} else {
		clients = this.connections;
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

	var that = this;

	// Create only inexistent channels
	if (!this.channels[name]) {
		this.channels[name] = new channel(this, name);
	}

	// Add connections to the channel
	if (filter) {
		this.connections.filter(filter).forEach(function (connection) {
			that.channels[name].bind(connection);
		});
	}

	return this.channels[name];
};

// Close the host
host.prototype.close = function () {

	// Close all connections
	this.connections.forEach(function (connection) {
		connection.close();
	});

	// Set the host inactive
	this.active = false;

	return this;
};

// Close and remove the host
host.prototype.destroy = function () {
	this.close();
	delete this.parent[this.location];
};

// Start the WebSocket host
host.prototype.open = function (config, callback) {

	// Use defined values if none is set
	config = config || this.config;
	callback = callback || this.callback;

	// Check the type of message limit size
	if (isNaN(config.limit)) {
		config.limit = 1048575;
	}

	// Check the type of protocols set
	if (!Array.isArray(config.protocols)) {
		config.protocols = [];
	}

	// Set the configuration and the callback
	this.callback = callback;
	this.config = {
		limit: config.limit,
		protocols: config.protocols.sort(),
		raw: config.raw || false
	};

	// Set the host active
	this.active = true;

	return this;
};

module.exports = host;