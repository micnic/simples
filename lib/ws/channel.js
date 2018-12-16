'use strict';

const WSConnection = require('simples/lib/ws/connection');
const WSFormatter = require('simples/lib/utils/ws-formatter');

const { EventEmitter } = require('events');

class WSChannel extends EventEmitter {

	constructor(host, channelName) {

		super();

		// Define WS channel public properties
		this.connections = new Set();

		// Define WS channel private properties
		this._advanced = host._advanced;
		this._host = host;
		this._name = channelName;
	}

	// Binds connections to the channel
	bind(connection) {

		// Check for valid connection instance to add it to the connections list
		if (connection instanceof WSConnection) {
			connection._channels.add(this);
			this.connections.add(connection);
			this.emit('bind', connection);
		}

		return this;
	}

	// Sends a message to the connections in the channel
	broadcast(event, data, filter) {

		// Broadcast the formatted data
		WSFormatter.broadcast(this, event, data, filter);

		return this;
	}

	// Drops all the connections from the channel, removes the channel
	close() {

		// Remove the channel from all its connections
		this.connections.forEach((connection) => {
			this.unbind(connection);
		});

		// Remove the channel from the host
		this._host._channels.delete(this._name);

		// Emit close event
		this.emit('close');
	}

	// Unbinds the connection from the channel
	unbind(connection) {

		// Remove the selected connection
		if (connection instanceof WSConnection) {
			connection._channels.delete(this);
			this.connections.delete(connection);
			this.emit('unbind', connection);
		}

		return this;
	}

	// WS channel factory method
	static create(host, channelName) {

		return new WSChannel(host, channelName);
	}
}

module.exports = WSChannel;