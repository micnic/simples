'use strict';

var events = require('events');

// WebSocket channel prototype constructor
var channel = function (parent, name) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for WebSocket channel
	Object.defineProperties(this, {
		connections: {
			value: [],
			writable: true
		},
		name: {
			value: name
		},
		parent: {
			value: parent
		}
	});
};

// Inherit from events.EventEmitter
channel.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: channel
	}
});

// Binds connections to the channel
channel.prototype.bind = function (connection) {

	// If the connection is not bound, put it in the end
	if (this.connections.indexOf(connection) < 0) {
		this.connections.push(connection);
		this.emit('bind', connection);
		connection.channels.push(this);
	}

	return this;
};

// Sends a message to the connections in the channel
channel.prototype.broadcast = function (event, data, filter) {

	var parent = this.parent;

	// Apply filtering and send data
	if (parent.options.mode === 'object') {

		// Check for filter function to apply
		if (typeof filter === 'function') {
			this.connections.forEach(function (connection, index, array) {
				if (filter(connection, index, array)) {
					connection.send(event, data);
				}
			});
		} else {
			this.connections.forEach(function (connection) {
				connection.send(event, data);
			});
		}

		// Emit broadcast event with the provided data
		this.emit('broadcast', event, data);
	} else {

		// Prepare arguments for non-object mode
		data = event;
		filter = data;

		// Check for filter function to apply
		if (typeof filter === 'function') {
			this.connections.forEach(function (connection, index, array) {
				if (filter(connection, index, array)) {
					connection.send(data);
				}
			});
		} else {
			clients.forEach(function (connection) {
				connection.send(data);
			});
		}

		// Emit broadcast event with the provided data
		this.emit('broadcast', data);
	}

	return this;
};

// Drops all the connections from the channel, removes the channel
channel.prototype.close = function () {

	var that = this;

	// Remove the channel from all its connections
	this.connections.forEach(function (connection) {
		connection.channels.splice(connection.channels.indexOf(that), 1);
	});

	// Emit close event and remove the channel
	this.emit('close');
	delete this.parent.channels[this.name];
};

// Unbinds the connection from the channel
channel.prototype.unbind = function (connection) {

	var index = this.connections.indexOf(connection);

	// Remove the selected connection
	if (index >= 0) {
		connection.channels.splice(connection.channels.indexOf(this), 1);
		this.connections.splice(index, 1);
		this.emit('unbind', connection);
	}

	// If there are no connections close the channel
	if (!this.connections.length) {
		this.close();
	}

	return this;
};

module.exports = channel;