'use strict';

const CookieParser = require('simples/lib/parsers/cookie-parser');
const QValueParser = require('simples/lib/parsers/q-value-parser');
const QsParser = require('simples/lib/parsers/qs-parser');
const url = require('url');

const { Transform } = require('stream');

const {
	dateFormatSlice,
	stringStreamOptions
} = require('simples/lib/utils/constants');

class AbstractConnection extends Transform {

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
		this.session = {};
		this.socket = request.connection;
		this.url = location;

		// Define abstract connection private properties
		this._router = router;
	}

	// Cookies getter
	get cookies() {

		// Check if cookies are not already parsed
		if (!this._cookies) {
			this._cookies = CookieParser.parse(this.headers.cookie);
		}

		return this._cookies;
	}

	// IP address getter
	get ip() {

		// Check if ip is not already defined
		if (!this._ip) {
			this._ip = this.request.connection.address();
		}

		return this._ip;
	}

	// Languages getter in order of their importance
	get langs() {

		// Check if languages are not already parsed
		if (!this._langs) {

			const header = this.headers['accept-language'];

			// Save parsed header
			this._langs = QValueParser.parse(header, false);
		}

		return this._langs;
	}

	// URL parsed query getter
	get query() {

		// Check if query string is not already parsed
		if (!this._query) {
			this._query = QsParser.parse(this.url.query);
		}

		return this._query;
	}

	// Destroy the connection socket
	destroy() {
		this.socket.destroy();
	}

	// Log data
	log(format, tokens, logger) {

		const date = new Date();

		// TODO: replace this with String(value).padStart(dateFormatSlice, '0')
		const day = `0${date.getDate()}`.substr(-dateFormatSlice);
		const hours = `0${date.getHours()}`.substr(-dateFormatSlice);
		const minutes = `0${date.getMinutes()}`.substr(-dateFormatSlice);
		const month = `0${date.getMonth() + 1}`.substr(-dateFormatSlice);
		const seconds = `0${date.getSeconds()}`.substr(-dateFormatSlice);
		const year = date.getFullYear();

		// Check if tokens are provided to apply them to the data
		if (tokens && typeof tokens === 'object') {
			Object.keys(tokens).forEach((token) => {

				const replacer = tokens[token];

				// Check for replacer function
				if (typeof replacer === 'function') {

					const rex = RegExp(`%${token}\\b`, 'g');

					// Replace custom token
					format = format.replace(rex, replacer(this));
				}
			});
		}

		// Replace default tokens
		format = format.replace(/%date\b/g, date.toUTCString());
		format = format.replace(/%day\b/g, day);
		format = format.replace(/%host\b/g, this.host);
		format = format.replace(/%hostname\b/g, this.hostname);
		format = format.replace(/%hour\b/g, hours);
		format = format.replace(/%href\b/g, this.href);
		format = format.replace(/%ip\b/g, this.ip.address);
		format = format.replace(/%minute\b/g, minutes);
		format = format.replace(/%month\b/g, month);
		format = format.replace(/%path\b/g, this.path);
		format = format.replace(/%protocol\b/g, this.protocol);
		format = format.replace(/%second\b/g, seconds);
		format = format.replace(/%short-date\b/g, `${day}.${month}.${year}`);
		format = format.replace(/%short-time\b/g, `${hours}:${minutes}`);
		format = format.replace(/%time\b/g, `${hours}:${minutes}:${seconds}`);
		format = format.replace(/%timestamp\b/g, date.valueOf());
		format = format.replace(/%year\b/g, year);

		// Check if the logger is a function
		if (typeof logger === 'function') {
			logger(`${format}\n`);
		} else if (process.stdout.isTTY) { // TODO: remove this for node.js 8.0+
			// eslint-disable-next-line
			console.log(format);
		}

		return this;
	}

	// Check if the origin header is accepted by the host (CORS)
	static isAccepted(connection, origins) {

		let accepted = true;
		let origin = connection.headers.origin;

		// Get the hostname from the origin
		if (origin) {
			origin = url.parse(origin).hostname;
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