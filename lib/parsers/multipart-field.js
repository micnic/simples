'use strict';

const {
	parseJSON,
	toBuffer,
	toString
} = require('simples/lib/utils/stream-utils');
const { PassThrough } = require('stream');

class MultipartField extends PassThrough {

	/**
	 * MultipartField constructor
	 * @param {string} name
	 * @param {string} filename
	 */
	constructor(name, filename) {

		super();

		// Prepare field members
		this.name = name;
		this.headers = {};

		// Check for file upload to add filename and type
		if (filename) {
			this.filename = filename;
		}
	}

	/**
	 * Get buffer field body
	 * @param {StreamConfig} config
	 * @returns {Promise<Buffer>}
	 */
	buffer(config) {

		return toBuffer(this, config && config.limit);
	}

	/**
	 * Parse JSON data from field body
	 * @param {StreamConfig} config
	 * @returns {Promise<*>}
	 */
	json(config) {

		return parseJSON(this, config && config.limit);
	}

	/**
	 * Get text field body
	 * @param {StreamConfig} config
	 * @returns {Promise<string>}
	 */
	text(config) {

		return toString(this, config && config.limit);
	}
}

module.exports = MultipartField;