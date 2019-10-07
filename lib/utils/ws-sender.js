'use strict';

const { stringify } = JSON;

class WSSender {

	/**
	 * Close the connection and set a close status code if needed
	 * @param {Connection} connection
	 * @param {number} code
	 * @param {Callback} callback
	 */
	static closeConnection(connection, code, callback) {

		let end = null;

		// Make arguments optional
		if (typeof code === 'number') {

			// Set the close status of the connection
			connection._status = code;

			// Check for provided callback
			if (typeof callback === 'function') {
				end = callback;
			}
		} else if (typeof code === 'function') {
			end = code;
		}

		// End the connection with the provided callback
		if (typeof end === 'function') {
			connection.end(end);
		} else {
			connection.end();
		}
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
			return stringify(output);
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