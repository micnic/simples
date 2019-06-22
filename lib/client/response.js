'use strict';

const {
	decodeBuffer,
	parseJSON,
	parseQS,
	toString
} = require('simples/lib/utils/stream-utils');

class Response {

	/**
	 * Response constructor
	 * @param {ServerResponse} response
	 */
	constructor(response) {

		this._response = response;
	}

	/**
	 * Getter for response body stream
	 * @returns {ServerResponse}
	 */
	get body() {

		return this._response;
	}

	/**
	 * Getter for response HTTP headers
	 * @returns {string[]}
	 */
	get headers() {

		return this._response.headers;
	}

	/**
	 * Getter for response network socket
	 * @returns {Socket}
	 */
	get socket() {

		return this._response.socket;
	}

	/**
	 * Getter for response status code
	 * @returns {number}
	 */
	get status() {

		return this._response.statusCode;
	}

	/**
	 * Get buffer response body
	 * @param {StreamConfig} config
	 * @returns {Promise<Buffer>}
	 */
	buffer(config) {

		return decodeBuffer(this._response, config && config.limit);
	}

	/**
	 * Parse JSON data from response body
	 * @param {StreamConfig} config
	 * @returns {Promise<*>}
	 */
	json(config) {

		return parseJSON(this._response, config && config.limit);
	}

	/**
	 * Parse query string data from response body
	 * @param {StreamConfig} config
	 * @returns {Promise<StringContainer>}
	 */
	qs(config) {

		return parseQS(this._response, config && config.limit);
	}

	/**
	 * Get text response body
	 * @param {StreamConfig} config
	 * @returns {Promise<string>}
	 */
	text(config) {

		return toString(this._response, config && config.limit);
	}
}

module.exports = Response;