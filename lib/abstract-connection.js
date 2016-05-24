'use strict';

var QsParser = require('simples/lib/parsers/qs'),
	stream = require('stream'),
	url = require('url');

// Abstract connection prototype constructor
var AbstractConnection = function (host, request) {

	var cookies = [],
		hostname = request.connection.localAddress,
		langs = [],
		protocol = 'http';

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Define private properties for connection
	Object.defineProperties(this, {
		cookies: {
			enumerable: true,
			get: function () {

				var header = this.headers.cookie;

				// Check if cookies are not already parsed
				if (!cookies.length && header) {
					cookies = AbstractConnection.parseCookies(header);
				}

				return cookies;
			}
		},
		langs: {
			enumerable: true,
			get: function () {

				var header = this.headers['accept-language'];

				// Check if languages are not already parsed
				if (!langs.length && header) {
					langs = AbstractConnection.parseLangs(header);
				}

				return langs;
			}
		},
		parent: {
			value: host
		},
		socket: {
			value: request.connection
		}
	});

	// Get the hostname
	if (request.headers.host) {
		hostname = request.headers.host;
	}

	// Check for protocol type
	if (request.headers.upgrade) {
		protocol = 'ws';
	}

	// Check for secured protocol
	if (this.socket.encrypted) {
		protocol += 's';
	}

	// Create and populate connection members
	this.data = {};
	this.headers = request.headers;
	this.ip = this.socket.address();
	this.protocol = protocol;
	this.params = {};
	this.session = {};
	this.url = url.parse(protocol + '://' + hostname + request.url);
	this.host = this.url.hostname;
	this.path = this.url.pathname;
	this.query = QsParser.parse(this.url.query);
};

// Get the cookies of the request
AbstractConnection.parseCookies = function (header) {

	var cookies = {},
		current = header[0],
		index = 0,
		length = 0,
		name = '',
		value = '';

	// Populate cookies
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the length of the name of the cookie
		while (current && current !== '=') {
			length++;
			current = header[index + length];
		}

		// Get the name of the cookie
		name = header.substr(index, length).trim();

		// Set the new index and reset length
		index += length;
		length = 0;

		// Skip "="
		if (current === '=') {
			index++;
			current = header[index];
		}

		// Get the length of the value of the cookie
		while (current && current !== ';') {
			length++;
			current = header[index + length];
		}

		// Get the value of the cookie
		value = decodeURIComponent(header.substr(index, length).trim());

		// Set the current cookie
		cookies[name] = value;

		// Prepare for the next cookie
		index += length + 1;
		length = 0;
		name = '';
		value = '';
		current = header[index];
	}

	return cookies;
};

// Get the languages accepted by the client
AbstractConnection.parseLangs = function (header) {

	var current = header[0],
		index = 0,
		langs = [],
		length = 0,
		name = '',
		quality = '';

	// Populate langs
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the length of the name of the language
		while (current && current !== ',' && current !== ';') {
			length++;
			current = header[index + length];
		}

		// Get the name of the language
		name = header.substr(index, length);

		// Set the new index and reset length
		index += length;
		length = 0;

		// Set the quality factor to 1 if none found or continue to get it
		if (!current || current === ',') {
			quality = '1';
		} else if (current === ';') {
			index++;
			current = header[index];
		}

		// Check for quality factor
		if (!quality && header.substr(index, 2) === 'q=') {
			index += 2;
			current = header[index];
		}

		// Get the length of the quality factor of the language
		while (!quality && current && current !== ',') {
			length++;
			current = header[index + length];
		}

		// Get the quality factor of the language
		if (!quality) {
			quality = header.substr(index, length);
		}

		// Add the current language to the set
		langs.push({
			name: name,
			quality: Number(quality)
		});

		// Prepare for the next language
		index += length + 1;
		length = 0;
		name = '';
		quality = '';
		current = header[index];
	}

	// Sort the languages in the order of their importance and return them
	return langs.sort(function (first, second) {
		return second.quality - first.quality;
	}).map(function (lang) {
		return lang.name;
	});
};

// Inherit from stream.Transform
AbstractConnection.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: AbstractConnection
	}
});

// Close the connection
AbstractConnection.prototype.close = function (callback) {

	// Check for a callback function for the finish event
	if (typeof callback === 'function') {
		this.end(callback);
	} else {
		this.end();
	}
};

// Destroy the connection socket
AbstractConnection.prototype.destroy = function () {
	this.socket.destroy();
};

// Log data
AbstractConnection.prototype.log = function (stream, data) {

	var date = new Date(),
		day = ('0' + date.getDate()).substr(-2),
		hours = ('0' + date.getHours()).substr(-2),
		minutes = ('0' + date.getMinutes()).substr(-2),
		month = ('0' + (date.getMonth() + 1)).substr(-2),
		seconds = ('0' + date.getSeconds()).substr(-2),
		that = this,
		year = date.getFullYear();

	// Make stream parameter optional
	if (arguments.length < 2) {
		data = stream;
		stream = null;
	}

	// Stringify non-string data
	if (data === undefined) {
		data = '';
	} else if (Buffer.isBuffer(data)) {
		data = String(data);
	} else if (typeof data !== 'string') {
		data = JSON.stringify(data);
	}

	// Replace defined tokens
	data = data.replace(/%date\b/g, String(date));
	data = data.replace(/%day\b/g, day);
	data = data.replace(/%host\b/g, this.host);
	data = data.replace(/%hour\b/g, hours);
	data = data.replace(/%ip\b/g, this.ip.address);
	data = data.replace(/%lang\b/g, this.lang());
	data = data.replace(/%method\b/g, this.method);
	data = data.replace(/%minute\b/g, minutes);
	data = data.replace(/%month\b/g, month);
	data = data.replace(/%path\b/g, this.path);
	data = data.replace(/%protocol\b/g, this.protocol);
	data = data.replace(/%second\b/g, seconds);
	data = data.replace(/%short-date\b/g, day + '.' + month + '.' + year);
	data = data.replace(/%short-time\b/g, hours + ':' + minutes);
	data = data.replace(/%status\b/g, this.status());
	data = data.replace(/%time\b/g, hours + ':' + minutes + ':' + seconds);
	data = data.replace(/%timestamp\b/g, Number(date));
	data = data.replace(/%type\b/g, this.type());
	data = data.replace(/%year\b/g, year);

	// Replace request headers
	data = data.replace(/%req\[([^\]]+)\]\b/g, function (match, p) {
		return that.request.headers[p];
	});

	// Replace response headers
	data = data.replace(/%res\[([^\]]+)\]\b/g, function (match, p) {
		return that.response.getHeader(p);
	});

	// Check if the stream is defined
	if (stream && stream.writable) {
		stream.write(data + '\n');
	} else if (process.stdout.isTTY) {
		// eslint-disable-next-line
		console.log(data);
	}

	return this;
};

module.exports = AbstractConnection;