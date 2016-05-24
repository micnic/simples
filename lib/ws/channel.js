'use strict';

var events = require('events'),
	WsMixin = require('simples/lib/mixins/ws-mixin'),
	WsWrapper = require('simples/lib/ws/wrapper');

// WS channel prototype constructor
var Channel = function (host, name) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for WebSocket channel
	Object.defineProperties(this, {
		connections: {
			value: [],
			enumerable: true
		},
		name: {
			value: name,
			enumerable: true
		},
		host: {
			value: host
		}
	});
};

// WS channel factory function
Channel.create = function (host, name) {

	return new Channel(host, name);
};

// Inherit from events.EventEmitter
Channel.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Channel
	}
});

// Binds connections to the channel
Channel.prototype.bind = function (connection) {

	// If the connection is not bound, put it in the end
	if (this.connections.indexOf(connection) < 0) {
		this.connections.push(connection);
		connection.channels.push(this);
		this.emit('bind', connection);
	}

	return this;
};

// Sends a message to the connections in the channel
Channel.prototype.broadcast = function (event, data, filter) {

	var host = this.host,
		mode = host.options.mode;

	// Broadcast the formatted data
	WsMixin.broadcast(this, WsWrapper.format(mode, event, data), filter);

	// Emit broadcast event with the provided data
	if (mode === 'object') {
		this.emit('broadcast', event, data);
	} else {
		this.emit('broadcast', data);
	}

	return this;
};

// Drops all the connections from the channel, removes the channel
Channel.prototype.close = function () {

	var that = this;

	// Remove the channel from all its connections
	this.connections.forEach(function (connection) {
		connection.channels.splice(connection.channels.indexOf(that), 1);
	});

	// Remove the channel from the host
	delete this.host.channels[this.name];

	// Emit close event
	this.emit('close');
};

// Unbinds the connection from the channel
Channel.prototype.unbind = function (connection) {

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

module.exports = Channel;