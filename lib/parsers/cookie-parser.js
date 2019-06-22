'use strict';

const equalsSign = '=';
const semicolon = ';';

class CookieParser {

	/**
	 * Get the cookies from the header
	 * @param {string} header
	 * @returns {*}
	 */
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

	/**
	 * Get the next index of searched char in the provided header
	 * @param {string} char
	 * @param {string} header
	 * @param {number} index
	 * @returns {number}
	 */
	static getNextIndexOf(char, header, index) {

		let i = index;

		// Loop through the header until the needed char is found
		while (header[i] && header[i] !== char) {
			i++;
		}

		return i;
	}
}

module.exports = CookieParser;