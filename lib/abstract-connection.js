'use strict';

const CookieParser = require('simples/lib/parsers/cookie-parser');
const LangParser = require('simples/lib/parsers/lang-parser');
const QsParser = require('simples/lib/parsers/qs-parser');
const url = require('url');

const { Transform } = require('stream');

const {
	dateFormatSlice,
	stringStreamOptions
} = require('simples/lib/utils/constants');

class AbstractConnection extends Transform {

	constructor(location, request) {

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
		this.url = location;

		// Define abstract connection private properties
		this._socket = request.connection;
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
			this._langs = LangParser.parse(header);
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
		this._socket.destroy();
	}

	// Log data
	log(data, logger, tokens) {

		const date = new Date();

		// TODO: replace this with String(value).padStart(dateFormatSlice, '0')
		const day = `0${date.getDate()}`.substr(-dateFormatSlice);
		const hours = `0${date.getHours()}`.substr(-dateFormatSlice);
		const minutes = `0${date.getMinutes()}`.substr(-dateFormatSlice);
		const month = `0${date.getMonth() + 1}`.substr(-dateFormatSlice);
		const seconds = `0${date.getSeconds()}`.substr(-dateFormatSlice);
		const year = date.getFullYear();

		// Make arguments optional
		if (typeof data === 'function') {
			if (typeof logger === 'object') {
				tokens = logger;
			}
			logger = data;
			data = null;
		} else if (typeof logger === 'object') {
			tokens = logger;
			logger = null;
		}

		// Stringify non-string data and add default
		if (!data) {
			data = '%short-date %time %method %href';
		} else if (Buffer.isBuffer(data)) {
			data = String(data);
		} else if (typeof data !== 'string') {
			data = JSON.stringify(data);
		}

		// Check if tokens are provided to apply them to the data
		if (tokens && typeof tokens === 'object') {
			Object.keys(tokens).forEach((token) => {

				const replacer = tokens[token];

				// Check for replacer function
				if (typeof replacer === 'function') {
					data = data.replace(RegExp(`%${token}\\b`, 'g'), replacer);
				}
			});
		}

		// Replace defined tokens
		data = data.replace(/%date\b/g, String(date));
		data = data.replace(/%day\b/g, day);
		data = data.replace(/%host\b/g, this.host);
		data = data.replace(/%hostname\b/g, this.hostname);
		data = data.replace(/%hour\b/g, hours);
		data = data.replace(/%href\b/g, this.href);
		data = data.replace(/%ip\b/g, this.ip.address);
		data = data.replace(/%minute\b/g, minutes);
		data = data.replace(/%month\b/g, month);
		data = data.replace(/%path\b/g, this.path);
		data = data.replace(/%protocol\b/g, this.protocol);
		data = data.replace(/%second\b/g, seconds);
		data = data.replace(/%short-date\b/g, `${day}.${month}.${year}`);
		data = data.replace(/%short-time\b/g, `${hours}:${minutes}`);
		data = data.replace(/%time\b/g, `${hours}:${minutes}:${seconds}`);
		data = data.replace(/%timestamp\b/g, Number(date));
		data = data.replace(/%year\b/g, year);

		// Check if the logger is a function
		if (typeof logger === 'function') {
			logger(`${data}\n`);
		} else if (process.stdout.isTTY) {
			// eslint-disable-next-line
			console.log(data);
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