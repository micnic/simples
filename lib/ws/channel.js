'use strict';

const WsConnection = require('simples/lib/ws/connection');
const WsUtils = require('simples/lib/utils/ws-utils');

const { EventEmitter } = require('events');

class WsChannel extends EventEmitter {

	constructor(parentHost, channelName) {

		super();

		// Define WS channel public properties
		this.connections = new Set();

		// Define WS channel private properties
		this._advanced = parentHost._advanced;
		this._host = parentHost;
		this._name = channelName;
	}

	// Binds connections to the channel
	bind(connection) {

		// Check for valid connection instance to add it to the connections list
		if (connection instanceof WsConnection) {
			connection._channels.add(this);
			this.connections.add(connection);
			this.emit('bind', connection);
		}

		return this;
	}

	// Sends a message to the connections in the channel
	broadcast(event, data, filter) {

		// Broadcast the formatted data
		WsUtils.broadcast(this, event, data, filter);

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
		if (connection instanceof WsConnection) {
			connection._channels.delete(this);
			this.connections.delete(connection);
			this.emit('unbind', connection);
		}

		return this;
	}

	// WS channel factory method
	static create(parentHost, channelName) {

		return new WsChannel(parentHost, channelName);
	}
}

module.exports = WsChannel;