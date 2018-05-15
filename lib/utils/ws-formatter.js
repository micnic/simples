'use strict';

class WsFormatter {

	// Write the data to the connections and filter them if needed
	static broadcast(broadcaster, event, data, filter) {

		const advancedMode = broadcaster._advanced;
		const message = WsFormatter.format(advancedMode, event, data);

		// Write the data to the connections and filter them if needed
		if (typeof filter === 'function') {
			broadcaster.connections.forEach((connection, index, set) => {
				if (filter(connection, index, set)) {
					connection.write(message);
				}
			});
		} else {
			broadcaster.connections.forEach((connection) => {
				connection.write(message);
			});
		}

		// Emit the broadcast event with the provided data
		if (advancedMode) {
			broadcaster.emit('broadcast', event, data);
		} else {
			broadcaster.emit('broadcast', message);
		}
	}

	// Prepare formatted data based on the WS advanced mode
	static format(advanced, event, data) {

		// Check for advanced mode
		if (advanced) {
			data = {
				data,
				event
			};
		} else {
			data = event;
		}

		// Stringify non-buffer data
		if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
			data = JSON.stringify(data);
		}

		return data;
	}

	// Write the data to the sender
	static send(sender, event, data, callback) {

		// Write formatted message to the connection
		sender.write(WsFormatter.format(sender._advanced, event, data));

		// Listen for event response in advanced mode if callback provided
		if (sender._advanced && typeof callback === 'function') {
			sender.once(event, callback);
		}
	}
}

module.exports = WsFormatter;