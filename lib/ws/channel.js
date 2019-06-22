'use strict';

const Broadcaster = require('simples/lib/ws/broadcaster');
const WSConnection = require('simples/lib/ws/connection');

class Channel extends Broadcaster {

	/**
	 * Channel constructor
	 * @param {WSHost} host
	 * @param {string} name
	 */
	constructor(host, name) {

		super(host._advanced);

		// Define WS channel private properties
		this._host = host;
		this._name = name;
	}

	/**
	 * Binds a connection to the channel
	 * @param {WSConnection}
	 * @returns {this}
	 */
	bind(connection) {

		// Check for valid connection instance to add it to the connections list
		if (connection instanceof WSConnection) {
			connection._channels.add(this);
			this.connections.add(connection);
			this.emit('bind', connection);
		}

		return this;
	}

	/**
	 * Drops all the connections from the channel and removes the channel
	 */
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

	/**
	 * Unbinds a connection from the channel
	 * @param {WSConnection} connection
	 * @returns {this}
	 */
	unbind(connection) {

		// Remove the selected connection
		if (connection instanceof WSConnection) {
			connection._channels.delete(this);
			this.connections.delete(connection);
			this.emit('unbind', connection);
		}

		return this;
	}
}

module.exports = Channel;