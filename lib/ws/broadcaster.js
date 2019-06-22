'use strict';

const { EventEmitter } = require('events');
const WSSender = require('simples/lib/utils/ws-sender');

class Broadcaster extends EventEmitter {

	/**
	 * Broadcaster constructor
	 * @param {boolean} advanced
	 */
	constructor(advanced) {

		super();

		// Define WS broadcaster connections collection
		this.connections = new Set();

		// Define WS broadcaster advanced mode
		this._advanced = advanced;
	}

	/**
	 * Sends a message to the connections of the broadcaster
	 * @param {string} event
	 * @param {*} data
	 * @param {WSFilterCallback} filter
	 * @returns {this}
	 */
	broadcast(event, data, filter) {

		const advanced = this._advanced;
		const message = WSSender.format(advanced, event, data);

		let check = filter;

		// If in simple mode make event argument optional
		if (!advanced) {
			check = data;
		}

		// Write the data to the connections and filter them if needed
		if (typeof check === 'function') {
			this.connections.forEach((connection, index, set) => {
				if (check(connection, index, set)) {
					connection.write(message);
				}
			});
		} else {
			this.connections.forEach((connection) => {
				connection.write(message);
			});
		}

		// Emit the broadcast event with the provided data
		if (advanced) {
			this.emit('broadcast', event, data);
		} else {
			this.emit('broadcast', message);
		}

		return this;
	}
}

module.exports = Broadcaster;