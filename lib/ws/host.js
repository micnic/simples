'use strict';

var channel = require('./channel');

// WS host prototype constructor
var host = function (location, config, listener) {

	var conf = {};

	// Define special properties for the WS host configuration
	Object.defineProperties(conf, {
		connectionListener: {
			value: null,
			writable: true
		},
		messageLimit: {
			value: 1048576,
			writable: true
		},
		rawMode: {
			value: false,
			writable: true
		},
		usedProtocols: {
			value: [],
			writable: true
		}
	});

	// Define special properties for the WS host
	Object.defineProperties(this, {
		channels: {
			value: {}
		},
		conf: {
			value: conf,
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

	// Configure the WS host
	this.config(config, listener);
};

// Send data to all active clients or a part of them
host.prototype.broadcast = function (event, data, filter) {

	var clients;

	// Prepare data
	if (this.config.rawMode) {
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
	if (this.config.rawMode) {
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

// Configure the WS host
host.prototype.config = function (config, listener) {

	// Set config optional
	if (arguments.length === 1) {
		listener = config;
		config = null;
	}

	// Use defined values if none is set
	config = config || this.conf;
	listener = listener || this.conf.connectionListener;

	// Check the type of message limit size
	if (typeof config.messageLimit === 'number') {
		this.conf.messageLimit = config.messageLimit;
	}

	// Check the type of protocols set
	if (Array.isArray(config.usedProtocols)) {
		this.conf.usedProtocols = config.usedProtocols;
	}

	// Check the type of raw mode flag
	if (typeof config.rawMode === 'boolean') {
		this.conf.rawMode = config.rawMode;
	}

	// Check the type of the connection listener
	if (typeof listener === 'function') {
		this.conf.connectionListener = listener;
	}

	return this;
};

// Close all connections and remove the WS host
host.prototype.destroy = function () {

	// Close all connections
	this.connections.forEach(function (connection) {
		connection.close();
	});

	delete this.parent[this.location];
};

module.exports = host;