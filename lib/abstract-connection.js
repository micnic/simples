'use strict';

const CookieParser = require('simples/lib/parsers/cookie-parser');
const QValueParser = require('simples/lib/parsers/q-value-parser');
const QSParser = require('simples/lib/parsers/qs-parser');
const { toTwoDigits } = require('simples/lib/utils/time-formatter');
const { Transform } = require('stream');
const { URL } = require('url');

const { keys } = Object;

// Stream options to not decode strings
const stringStreamOptions = {
	decodeStrings: false
};

class AbstractConnection extends Transform {

	/**
	 * AbstractConnection constructor
	 * @param {Router} router
	 * @param {string} location
	 * @param {IncomingMessage} request
	 */
	constructor(router, location, request) {

		super(stringStreamOptions);

		// Define abstract connection public properties
		this.data = {};
		this.headers = request.headers;
		this.host = location.host;
		this.hostname = location.hostname;
		this.href = location.href;
		this.params = {};
		this.path = location.pathname;
		this.protocol = location.protocol.slice(0, -1);
		this.request = request;
		this.session = null;
		this.socket = request.socket;
		this.url = location;

		// Define abstract connection private properties
		this._router = router;
	}

	/**
	 * Cookies getter
	 * @returns {StringContainer}
	 */
	get cookies() {

		// Check if cookies are not already parsed
		if (!this._cookies) {
			this._cookies = CookieParser.parse(this.headers.cookie);
		}

		return this._cookies;
	}

	/**
	 * IP address getter
	 * @returns {IPAddress}
	 */
	get ip() {

		// Check if ip is not already defined
		if (!this._ip) {
			this._ip = this.socket.address();
		}

		return this._ip;
	}

	/**
	 * Languages getter in order of their importance
	 * @returns {string[]}
	 */
	get langs() {

		// Check if languages are not already parsed
		if (!this._langs) {

			const header = this.headers['accept-language'];

			// Save parsed header
			this._langs = QValueParser.parse(header, false);
		}

		return this._langs;
	}

	/**
	 * URL parsed query getter
	 * @returns {StringContainer}
	 */
	get query() {

		// Check if query string is not already parsed
		if (!this._query) {
			this._query = QSParser.parse(this.url.query);
		}

		return this._query;
	}

	/**
	 * Destroy the connection socket
	 */
	destroy() {
		this.socket.destroy();
	}

	/**
	 * Log data
	 * @param {string} format
	 * @param {Tokens} tokens
	 * @param {StringCallback} logger
	 * @returns {this}
	 */
	log(format, tokens, logger) {

		const date = new Date();

		const day = toTwoDigits(date.getDate());
		const hours = toTwoDigits(date.getHours());
		const minutes = toTwoDigits(date.getMinutes());
		const month = toTwoDigits(date.getMonth() + 1);
		const seconds = toTwoDigits(date.getSeconds());
		const year = date.getFullYear();

		let output = format;

		// Check if tokens are provided to apply them to the data
		if (tokens && typeof tokens === 'object') {
			keys(tokens).forEach((token) => {

				const replacer = tokens[token];

				// Check for replacer function
				if (typeof replacer === 'function') {

					const rex = RegExp(`%${token}\\b`, 'g');

					// Replace custom token
					output = output.replace(rex, replacer(this));
				}
			});
		}

		// Replace default tokens
		output = output.replace(/%date\b/g, date.toUTCString());
		output = output.replace(/%day\b/g, day);
		output = output.replace(/%host\b/g, this.host);
		output = output.replace(/%hostname\b/g, this.hostname);
		output = output.replace(/%hour\b/g, hours);
		output = output.replace(/%href\b/g, this.href);
		output = output.replace(/%ip\b/g, this.ip.address);
		output = output.replace(/%minute\b/g, minutes);
		output = output.replace(/%month\b/g, month);
		output = output.replace(/%path\b/g, this.path);
		output = output.replace(/%protocol\b/g, this.protocol);
		output = output.replace(/%second\b/g, seconds);
		output = output.replace(/%short-date\b/g, `${day}.${month}.${year}`);
		output = output.replace(/%short-time\b/g, `${hours}:${minutes}`);
		output = output.replace(/%time\b/g, `${hours}:${minutes}:${seconds}`);
		output = output.replace(/%timestamp\b/g, date.valueOf());
		output = output.replace(/%year\b/g, year);

		// Check if the logger is a function
		if (typeof logger === 'function') {
			logger(`${output}\n`);
		} else {
			process.stdout.write(`${output}\n`);
		}

		return this;
	}

	/**
	 * Check if the origin header is accepted by the host (CORS)
	 * @param {Connection} connection
	 * @param {string[]} origins
	 * @returns {boolean}
	 */
	static isAccepted(connection, origins) {

		let accepted = true;
		let origin = connection.headers.origin;

		// Get the hostname from the origin
		if (origin) {
			origin = new URL(origin).hostname;
		}

		// Check if the origin is accepted
		if (origin && origin !== connection.hostname) {
			if (origins.indexOf(origin) < 0) {
				accepted = (origins[0] === '*');
			} else {
				accepted = (origins[0] !== '*');
			}
		}

		return accepted;
	}
}

module.exports = AbstractConnection;