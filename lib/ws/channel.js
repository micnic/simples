// Channel prototype constructor
var channel = module.exports = function (name, raw) {
	'use strict';

	var that = this;

	function disconnect() {
		var index = that.connections.length;
		while (index--) {
			if (that.connections[index] === this) {
				that.connections.splice(index, 1);
				break;
			}
		}
	}

	this.name = name;
	Object.defineProperties(this, {
		connections: {
			value: [],
			writable: true
		},
		disconnect: {
			value: disconnect
		},
		raw: {
			value: raw
		}
	});
};

// Binds connections to the channel
channel.prototype.bind = function(connection) {
	'use strict';

	var index = this.connections.length;
	while (index--) {
		if (this.connections[index] === connection) {
			this.connections.splice(index, 1);
			break;
		}
	}

	if (!~index) {
		this.connections[this.connections.length] = connection;
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
	return this;
};

// Drops all the connections from the channel
channel.prototype.close = function () {
	'use strict';

	var index = this.connections.length;
	while (index--) {
		this.connections[index].removeListener('close', this.disconnect);
		this.connections.splice(index, 1);
	}
};

// Unbinds the connection from the channel
channel.prototype.unbind = function (connection) {
	'use strict';

	var index = this.connections.length;
	while (index--) {
		if (this.connections[index] === connection) {
			connection.removeListener('close', this.disconnect);
			this.connections.splice(index, 1);
			break;
		}
	}
	return this;
};