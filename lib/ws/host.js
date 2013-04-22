var channel = require('./channel'),
	url = require('url');

// WebSocket host prototype constructor
var host = module.exports = function (location, config, callback) {
	'use strict';

	// Define WebSocket host properties
	Object.defineProperties(this, {
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
			value: url.parse(location, true)
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
	this.open();
};

// Send data to all active clients or a part of them
host.prototype.broadcast = function (event, data, filter) {
	'use strict';

	// Check for raw mode
	var args,
		clients,
		index;
	if (this.raw) {
		data = event;
		filter = data;
		args = [data];
	} else {
		args = [event, data];
	}

	// Prepare clients
	if (filter) {
		clients = this.connections.filter(filter);
	} else {
		clients = this.connections;
	}

	// Send data to the clients
	index = clients.length;
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

	config = config || this.config;
	callback = callback || this.callback;

	// Open host only if is not started
	if (!this.started) {

		// Type conformity
		if (isNaN(config.length)) {
			config.length = 1048575;
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