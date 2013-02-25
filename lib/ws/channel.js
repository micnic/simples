var events = require('events');

// Channel prototype constructor
var channel = module.exports = function (name, raw) {
	'use strict';

	// Shortcut for this context
	var that = this;

	// Connection close listener
	function disconnect() {

		// Search for the connection
		var index = that.connections.length;
		while (that.connections[index] !== this) {
			index--;
		}

		// Drop the found connection
		that.connections.splice(index, 1);

		// Close the channel if there are no connections
		if (!that.connections.length) {
			that.close();
		}
	}

	// Set hidden properties for channel
	Object.defineProperties(this, {
		connections: {
			value: [],
			writable: true
		},
		disconnect: {
			value: disconnect
		},
		name: {
			value: name
		},
		parent: {
			value: null,
			writable: true
		},
		raw: {
			value: raw
		}
	});
};

// Inherit from events.EventEmitter
channel.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: channel,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Binds connections to the channel
channel.prototype.bind = function(connection) {
	'use strict';

	// Check if the connection is bound
	var index = this.connections.length;
	while (index--) {
		if (this.connections[index] === connection) {
			break;
		}
	}

	// If the connection is not bound, put it in the end
	if (!~index) {
		this.connections[this.connections.length] = connection;
		this.emit('bind', connection);
		connection.on('close', this.disconnect);
	}

	return this;
};

// Sends a message to the connections in the channel
channel.prototype.broadcast = function () {
	'use strict';

	// Check for raw mode
	var args;
	var data;
	var event;
	var filter;
	if (this.raw) {
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

	this.emit('broadcast', args[0], args[1]);
	return this;
};

// Drops all the connections from the channel, removes the channel
channel.prototype.close = function () {
	'use strict';

	// Remove the close listener of each connection
	var index = this.connections.length;
	if (index) {
		while (index--) {
			this.connections[index].removeListener('close', this.disconnect);
		}
	}

	// Emit close and remove the channel
	this.emit('close');
	delete this.parent.channels[this.name];
};

// Unbinds the connection from the channel
channel.prototype.unbind = function (connection) {
	'use strict';

	// Remove the needed connection
	var index = this.connections.length;
	while (index--) {
		if (this.connections[index] === connection) {
			connection.removeListener('close', this.disconnect);
			this.connections.splice(index, 1);
			this.emit('unbind', connection);
			break;
		}
	}

	// If there are no connections close the channel
	if (!this.connections.length) {
		this.close();
	}

	return this;
};