'use strict';

const { StringDecoder } = require('string_decoder');
const { Transform } = require('stream');

const {
	emptyString,
	errors: {
		invalidUtf8Data
	},
	stringReadableObjectMode
} = require('simples/lib/utils/constants');

class ConcatStream extends Transform {

	constructor() {

		super(stringReadableObjectMode);

		// String buffer to save data before parsing it
		this.buffer = emptyString;

		// String decoder to safely transfer data from buffers to strings
		this.decoder = new StringDecoder();
	}

	// Flush method implementation
	_flush(callback) {

		const replacement = this.decoder.end();

		// Check if there is any unfinished UTF8 sequence
		if (replacement.length) {

			// Call the callback with error
			callback(invalidUtf8Data);
		} else {

			// Push the result, should be implemented by child classes
			this.pushResult(callback);
		}

		// Reset parser properties
		this.buffer = null;
		this.decoder = null;
	}

	// Transform method implementation
	_transform(chunk, encoding, callback) {

		// Stringify chunk data
		if (typeof chunk === 'string') {
			this.buffer += chunk;
		} else {
			this.buffer += this.decoder.write(chunk);
		}

		// End current transform
		callback(null);
	}
}

module.exports = ConcatStream;