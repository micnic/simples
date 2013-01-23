var channel = require('./channel');

// WebSocket host prototype constructor
var host = module.exports = function (parent, location, config, callback) {
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
			value: parent
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

	var index = this.connections.length;

	// Close all connections
	while (index--) {
		this.connections[index].close();
	}

	this.started = false;
	return this;
};

// Create a new channel for grouping connections
host.prototype.openChannel = function (name) {
	'use strict';

	// Create only inexistent channels
	if (!(name in this.channels)) {
		this.channels[name] = new channel(name, this.config.raw);
	}

	return this.channels[name];
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

	this.callback = callback;
	this.config = {
		length: config.length || 1048575,
		protocols: config.protocols.sort() || [],
		raw: config.raw || false
	};
	this.started = true;
	return this;
};