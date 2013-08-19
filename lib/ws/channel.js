'use strict';

var events = require('events');

// WebSocket channel prototype constructor
var channel = function (parent, name) {

	// Shortcut for this context
	var that = this;

	// Update connections array on connection close
	function update() {

		// Remove the found connection
		that.connections.splice(that.connections.indexOf(this), 1);

		// Close the channel if there are no connections
		if (!that.connections.length) {
			that.close();
		}
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define special properties for WebSocket channel
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
		},
		update: {
			value: update
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
		connection.on('close', this.update);
	}

	return this;
};

// Sends a message to the connections in the channel
channel.prototype.broadcast = function (event, data, filter) {

	var clients;

	// Prepare data
	if (this.parent.config.raw) {
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

	// Remove the close listener of each connection
	this.connections.forEach(function (connection) {
		connection.removeListener('close', this.update);
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
		connection.removeListener('close', this.update);
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