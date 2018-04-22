'use strict';

const {
	chars: {
		equalsSign,
		semicolon
	}
} = require('simples/lib/utils/constants');

class CookieParser {

	// Get the cookies from the header
	static parse(header) {

		const cookies = Object.create(null);

		// Check if there is any header provided
		if (header) {

			let begin = 0;
			let end = 0;

			// Parse cookies char by char
			while (header[begin]) {

				// Get the end index of the cookie name
				end = CookieParser.getNextIndexOf(equalsSign, header, begin);

				const name = header.slice(begin, end).trim();

				// Set the begin and end indexes for the value
				begin = end + 1;

				// Get the end index of the cookie value
				end = CookieParser.getNextIndexOf(semicolon, header, begin);

				const value = header.slice(begin, end).trim();

				// Save the current cookie
				cookies[name] = decodeURIComponent(value);

				// Prepare the begin and end indexes for the next cookie
				begin = end + 1;
			}
		}

		return cookies;
	}

	// Get the next index of searched char in the provided header
	static getNextIndexOf(char, header, index) {

		// Loop through the header until the needed char is found
		while (header[index] && header[index] !== char) {
			index++;
		}

		return index;
	}
}

module.exports = CookieParser;