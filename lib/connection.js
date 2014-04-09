'use strict';

var stream = require('stream'),
	url = require('url'),
	utils = require('simples/utils/utils');

// Abstract connection prototype constructor
var connection = function (host, request) {

	var cookies = null,
		hostname = '',
		langs = null,
		protocol = 'http',
		that = this;

	// Getter for connection cookies
	function getCookies() {

		// Check if cookies are not already parsed
		if (!cookies) {
			cookies = utils.parseCookies(that);
		}

		return cookies;
	}

	// Getter for connection accepted languages
	function getLangs() {

		// Check if languages are not already parsed
		if (!langs) {
			langs = utils.parseLangs(that);
		}

		return langs;
	}

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Define special properties for the connection
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
	} else {
		hostname = this.socket.localAddress;
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