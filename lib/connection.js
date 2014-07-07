'use strict';

var stream = require('stream'),
	url = require('url');

// Abstract connection prototype constructor
var connection = function (host, request) {

	var cookies = null,
		hostname = request.connection.localAddress,
		langs = null,
		protocol = 'http';

	// Getter for connection cookies
	function getCookies() {

		// Check if cookies are not already parsed
		if (!cookies) {
			cookies = connection.parseCookies(request);
		}

		return cookies;
	}

	// Getter for connection accepted languages
	function getLangs() {

		// Check if languages are not already parsed
		if (!langs) {
			langs = connection.parseLangs(request);
		}

		return langs;
	}

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Define private properties for connection
	Object.defineProperties(this, {
		cookies: {
			enumerable: true,
			get: getCookies
		},
		langs: {
			enumerable: true,
			get: getLangs
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
	this.headers = request.headers;
	this.ip = this.socket.remoteAddress;
	this.protocol = protocol;
	this.session = {};
	this.url = url.parse(protocol + '://' + hostname + request.url, true);
	this.host = this.url.hostname;
	this.path = this.url.pathname;
	this.query = this.url.query;
};

// Get the languages accepted by the client
connection.parseLangs = function (request) {

	var current = '',
		header = '',
		index = 0,
		langs = [],
		name = '',
		quality = '',
		ready = false;

	// Check if the request has the accept-language header
	if (request.headers['accept-language']) {
		header = request.headers['accept-language'];
	}

	// Get the first character
	current = header[0];

	// Populate langs
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the name of the language
		while (current && current !== ',' && current !== ';') {
			name += current;
			index++;
			current = header[index];
		}

		// Set the quality factor to 1 if none found or continue to get it
		if (!current || current === ',') {
			quality = 1;
			ready = true;
		} else if (current === ';') {
			index++;
			current = header[index];
		}

		// Check for quality factor
		if (!ready && header.substr(index, 2) === 'q=') {
			index += 2;
			current = header[index];
		}

		// Get the quality factor of the languages
		while (!ready && current && current !== ',') {
			quality += current;
			index++;
			current = header[index];
		}

		// Add the language to the set
		langs.push({
			name: name,
			quality: Number(quality)
		});

		// Reset flags and wait for the next language
		name = '';
		quality = '';
		ready = false;
		index++;
		current = header[index];
	}

	// Sort the languages in the order of their importance and return them
	return langs.sort(function (first, second) {
		return second.quality - first.quality;
	}).map(function (element) {
		return element.name;
	});
};

// Get the cookies of the request
connection.parseCookies = function (request) {

	var cookies = {},
		current = '',
		header = '',
		index = 0,
		name = '',
		value = '';

	// Check if the request has the cookie header
	if (request.headers.cookie) {
		header = request.headers.cookie;
	}

	// Get the first character
	current = header[0];

	// Populate cookies
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the name of the cookie
		while (current && current !== '=') {
			name += current;
			index++;
			current = header[index];
		}

		// Skip "="
		if (current === '=') {
			index++;
			current = header[index];
		}

		// Get the value of the cookie
		while (current && current !== ';') {
			value += current;
			index++;
			current = header[index];
		}

		// Set the current cookie and wait for the next one
		cookies[name] = decodeURIComponent(value);
		name = '';
		value = '';
		index++;
		current = header[index];
	}

	return cookies;
};

// Inherit from stream.Transform
connection.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: connection
	}
});

// Close the connection
connection.prototype.close = function (callback) {

	// Check for a callback function for the finish event
	if (typeof callback === 'function') {
		this.end(callback);
	} else {
		this.end();
	}
};

module.exports = connection;