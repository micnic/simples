'use strict';

const ConcatStream = require('simples/lib/parsers/concat-stream');

class JSONParser extends ConcatStream {

	// Push result method implementation
	pushResult(callback) {

		// Try to parse the received data
		try {

			// Parse the received data and push the result to the stream
			this.push(JSON.parse(this.buffer));

			// End parsing
			callback(null);
		} catch (error) {

			// End parsing with error
			callback(error);
		}
	}

	// JSON parser factory method
	static create() {

		return new JSONParser();
	}
}

module.exports = JSONParser;