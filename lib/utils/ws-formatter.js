'use strict';

class WSFormatter {

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
}

module.exports = WSFormatter;