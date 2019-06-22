'use strict';

const { unescape } = require('querystring');

const ampersand = '&';
const arrayNotation = '[]';
const arrayNotationLength = arrayNotation.length;
const emptyString = '';
const equalsSign = '=';
const expectKey = Symbol('expect-key');
const expectValue = Symbol('expect-value');
const keyEscapeMask = 2;
const percentSign = '%';
const plusSign = '+';
const space = ' ';
const valueEscapeMask = 1;

class QSParser {

	/**
	 * Static method for parsing strings
	 * @param {string} query
	 * @returns {*}
	 */
	static parse(query) {

		const result = Object.create(null);

		// Check if there is any query provided
		if (typeof query === 'string' && query.length > 0) {

			let escaped = 0;
			let expect = expectKey;
			let key = emptyString;
			let value = emptyString;

			// Loop through all received characters and parse them
			for (const char of query) {

				// Parse current character
				if (char === ampersand) {
					QSParser.addEntry(result, key, value, escaped);
					escaped = false;
					expect = expectKey;
					key = emptyString;
					value = emptyString;
				} else if (expect === expectValue) {
					if (char === plusSign) {
						value += space;
					} else {

						// Add current char to the value
						value += char;

						// Mark escaped value
						if (char === percentSign) {
							escaped |= valueEscapeMask;
						}
					}
				} else if (char === equalsSign) {
					expect = expectValue;
				} else if (char === plusSign) {
					key += space;
				} else {

					// Add current char to the key
					key += char;

					// Mark escaped key
					if (char === percentSign) {
						escaped |= keyEscapeMask;
					}
				}
			}

			// Add last data entry
			QSParser.addEntry(result, key, value);
		}

		return result;
	}

	/**
	 * Unescape key and value and add the data to the result
	 * @param {*} result
	 * @param {string} key
	 * @param {string} value
	 * @param {number} escaped
	 */
	static addEntry(result, key, value, escaped) {

		let array = false;
		let k = key;
		let v = value;

		// Check escaped key and unescape it
		if (escaped & keyEscapeMask) {
			k = unescape(k);
		}

		// Check escaped value and unescape it
		if (escaped & valueEscapeMask) {
			v = unescape(v);
		}

		// Check for array notation
		if (key.endsWith(arrayNotation)) {

			// Set array format flag
			array = true;

			// Remove the array square brackets from the key
			k = k.slice(0, -arrayNotationLength);
		}

		// Add the key and the value to the result
		if (k) {

			const prev = result[k];

			// Add value or merge multiple values into arrays
			if (typeof prev === 'string') {
				result[k] = [prev, v];
			} else if (prev) {
				prev.push(v);
			} else if (array) {
				result[k] = [v];
			} else {
				result[k] = v;
			}
		}
	}
}

// Export the parser
module.exports = QSParser;