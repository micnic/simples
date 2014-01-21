'use strict';

var events = require('events');

// WS channel prototype constructor
var channel = function (parent, name) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define special properties for the WS channel
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

	var clients = this.connections;

	// Prepare data
	if (this.parent.config.raw) {
		data = event;
		filter = data;
	}

	// Prepare clients
	if (filter) {
		clients = this.connections.filter(filter);
	}

	// Send data to the clients
	if (this.parent.config.raw) {
		clients.forEach(function (connection) {
			connection.send(data);
		});
		this.emit('broadcast', data);
	} else {
		clients.forEach(function (connection) {
			connection.send(event, data);
		});
		this.emit('broadcast', event, data);
	}

	return this;
};

// Drops all the connections from the channel, removes the channel
channel.prototype.close = function () {

	var that = this;

	// Remove the close listener of each connection
	this.connections.forEach(function (connection) {
		connection.splice(connection.channels.indexOf(that), 1);
	});

	// Emit close and remove the channel
	this.emit('close');
	delete this.parent.channels[this.name];
};

// Unbinds the connection from the channel
channel.prototype.unbind = function (connection) {

	var index = this.connections.indexOf(connection);

	// Remove the needed connection
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