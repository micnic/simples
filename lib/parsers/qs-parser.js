'use strict';

const qs = require('querystring');
const ConcatStream = require('simples/lib/parsers/concat-stream');

const { arrayNotationLength } = require('simples/lib/utils/constants');
const { expectKey, expectValue } = require('simples/lib/utils/symbols');

class QSParser extends ConcatStream {

	// Push result method implementation
	pushResult(callback) {

		// Push the result of the parsing
		this.push(QSParser.parse(this.buffer));

		// End the parsing
		callback(null);
	}

	// Push data entries to the result
	static addData(result, key, value, formatArray) {

		const prev = result[key];

		// Add value or merge multiple values into arrays
		if (typeof prev === 'string') {
			result[key] = [];
			result[key].push(prev, value);
		} else if (prev) {
			prev.push(value);
		} else if (formatArray) {
			result[key] = [];
			result[key].push(value);
		} else {
			result[key] = value;
		}
	}

	// Static method for parsing strings
	static parse(query) {

		const result = Object.create(null);

		// Check if there is any query provided
		if (query) {

			const state = {
				expect: expectKey,
				key: '',
				value: ''
			};

			let [ char ] = query;
			let index = 0;

			// Loop through all received characters and parse them
			while (char) {

				// Parse current character
				QSParser.parseChar(char, result, state);

				// Get the next character
				index++;
				char = query[index];
			}

			// Add last data entry
			QSParser.prepareResult(result, state.key, state.value);
		}

		return result;
	}

	// Parse current character
	static parseChar(char, result, state) {

		// Parse data
		if (char === '&') {
			QSParser.prepareResult(result, state.key, state.value);
			state.expect = expectKey;
			state.key = '';
			state.value = '';
		} else if (state.expect === expectValue) {
			state.value += char;
		} else if (char === '=') {
			state.expect = expectValue;
		} else {
			state.key += char;
		}
	}

	// Unescape key and value and add the data to the result
	static prepareResult(result, key, value) {

		let formatArray = false;

		// Extract unescaped values from the key and the value
		key = qs.unescape(key);
		value = qs.unescape(value);

		// Check for array notation
		if (key.endsWith('[]')) {

			// Set array format flag
			formatArray = true;

			// Remove the array square brackets from the key
			key = key.slice(0, -arrayNotationLength);
		}

		// Add the key and the value to the result
		if (key) {
			QSParser.addData(result, key, value, formatArray);
		}
	}
}

// Export the parser
module.exports = QSParser;