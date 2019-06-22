'use strict';

const mime = require('mime.json');

class TypeUtils {

	/**
	 * Get content type from short notation
	 * @param {string} value
	 * @returns {string}
	 */
	static getContentType(value) {

		let type = value;

		// Remove leading point from type
		if (type[0] === '.') {
			type = type.slice(1);
		}

		// Use lower case for comparing content type
		type = type.toLowerCase();

		// Check if the MIME type is defined in the list
		if (mime[type]) {
			type = mime[type];
		} else {
			type = mime.bin;
		}

		// Append the charset UTF-8 for the text content type
		if (type.startsWith('text/')) {
			type += ';charset=utf-8';
		}

		return type;
	}
}

module.exports = TypeUtils;