'use strict';

const WSFormatter = require('simples/lib/utils/ws-formatter');
const { EventEmitter } = require('events');

class Broadcaster extends EventEmitter {

	constructor(advanced) {

		super();

		// Define WS broadcaster connections collection
		this.connections = new Set();

		// Define WS broadcaster advanced mode
		this._advanced = advanced;
	}

	// Sends a message to the connections of the broadcaster
	broadcast(event, data, filter) {

		const advancedMode = this._advanced;
		const message = WSFormatter.format(advancedMode, event, data);

		// If in simple mode make event argument optional
		if (!advancedMode) {
			filter = data;
		}

		// Write the data to the connections and filter them if needed
		if (typeof filter === 'function') {
			this.connections.forEach((connection, index, set) => {
				if (filter(connection, index, set)) {
					connection.write(message);
				}
			});
		} else {
			this.connections.forEach((connection) => {
				connection.write(message);
			});
		}

		// Emit the broadcast event with the provided data
		if (advancedMode) {
			this.emit('broadcast', event, data);
		} else {
			this.emit('broadcast', message);
		}

		return this;
	}
}

module.exports = Broadcaster;