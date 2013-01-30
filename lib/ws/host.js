var channel = require('./channel');

// WebSocket host prototype constructor
var host = module.exports = function (location, config, callback) {
	'use strict';

	// Define WebSocket host properties
	Object.defineProperties(this, {
		callback: {
			value: null,
			writable: true
		},
		channels: {
			value: {}
		},
		config: {
			value: null,
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
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Start the WebSocket host with the given configuration
	this.open(config, callback);
};

// Send data to all active clients or a part of them
host.prototype.broadcast = function () {
	'use strict';

	// Check for raw mode
	var args;
	var data;
	var event;
	var filter;
	if (this.config.raw) {
		data = arguments[0];
		filter = arguments[1];
		args = [data];
	} else {
		event = arguments[0];
		data = arguments[1];
		filter = arguments[2];
		args = [event, data];
	}

	// Prepare clients
	var clients;
	if (filter) {
		clients = this.connections.filter(filter);
	} else {
		clients = this.connections;
	}

	// Send data to the clients
	var index = clients.length;
	while (index--) {
		clients[index].send.apply(clients[index], args);
	}
	return this;
};

// Stop the WebSocket host
host.prototype.close = function () {
	'use strict';

	// Close host only if is started
	if (this.started) {
		var index = this.connections.length;

		// Close all connections
		while (index--) {
			this.connections[index].close();
		}

		this.started = false;
	}

	return this;
};

// Removes the WebSocket host from the list
host.prototype.destroy = function () {
	'use strict';
	this.close();
	delete this.parent[this.location];
};

// Start the WebSocket host
host.prototype.open = function (config, callback) {
	'use strict';

	// Open host only if is not started
	if (!this.started) {

		// Type conformity
		if (isNaN(config.length)) {
			config.length = 1048575
		}

		if (!Array.isArray(config.protocols)) {
			config.protocols = [];
		}

		this.callback = callback;
		this.config = {
			length: config.length,
			protocols: config.protocols.sort(),
			raw: config.raw || false
		};
		this.started = true;
	}

	return this;
};

// Returns a channel for grouping connections
host.prototype.channel = function (name) {
	'use strict';

	// Create only inexistent channels
	if (!this.channels[name]) {
		this.channels[name] = new channel(name, this.config.raw);
		this.channels[name].parent = this;
	}

	return this.channels[name];
};