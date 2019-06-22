'use strict';

const Args = require('simples/lib/utils/args');

const connectionCloseArgTypes = [
	'number',
	'function'
];

class WSSender {

	/**
	 * Close the connection and set a close status code if needed
	 * @param {Connection} connection
	 * @param {number} code
	 * @param {Callback} callback
	 */
	static closeConnection(connection, code, callback) {

		// Make arguments optional
		[
			code,
			callback
		] = Args.getArgs(connectionCloseArgTypes, code, callback);

		// Set the close status of the connection
		if (code) {
			connection._status = code;
		}

		// End the connection and call the callback if needed
		connection.end(callback);
	}

	/**
	 * Prepare formatted data based on the WS advanced mode
	 * @param {boolean} advanced
	 * @param {string} event
	 * @param {*} data
	 * @returns {string}
	 */
	static format(advanced, event, data) {

		let output = event;

		// Check for advanced mode
		if (advanced) {
			output = {
				data,
				event
			};
		}

		// Stringify non-buffer data
		if (typeof output !== 'string' && !Buffer.isBuffer(output)) {
			return JSON.stringify(output);
		}

		return output;
	}

	/**
	 * Send data to the client
	 * @param {string} event
	 * @param {*} data
	 * @param {DataCallback<*>} callback
	 */
	static send(connection, event, data, callback) {

		// Write formatted message to the connection
		connection.write(WSSender.format(connection._advanced, event, data));

		// Listen for event response in advanced mode if callback provided
		if (connection._advanced && typeof callback === 'function') {
			connection.once(event, callback);
		}
	}
}

module.exports = WSSender;