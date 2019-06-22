'use strict';

const {
	decodeBuffer,
	parseJSON,
	parseQS,
	toString
} = require('simples/lib/utils/stream-utils');

class Body {

	/**
	 * Body constructor
	 * @param {IncomingMessage} request
	 */
	constructor(request) {

		this._request = request;
	}

	/**
	 * Get request body buffer
	 * @param {StreamConfig} config
	 * @returns {Promise<Buffer>}
	 */
	buffer(config) {

		return decodeBuffer(this._request, config && config.limit);
	}

	/**
	 * Parse JSON data from request body
	 * @param {StreamConfig} config
	 * @returns {Promise<*>}
	 */
	json(config) {

		return parseJSON(this._request, config && config.limit);
	}

	/**
	 * Parse query string data from request body
	 * @param {StreamConfig} config
	 * @returns {Promise<StringContainer>}
	 */
	qs(config) {

		return parseQS(this._request, config && config.limit);
	}

	/**
	 * Get text request body
	 * @param {StreamConfig} config
	 * @returns {Promise<string>}
	 */
	text(config) {

		return toString(this._request, config && config.limit);
	}
}

module.exports = Body;