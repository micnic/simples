'use strict';

var stream = require('stream'),
	url = require('url'),
	utils = require('simples/utils/utils');

// Abstract connection prototype constructor
var connection = function (host, request) {

	var cookies = null,
		hostname = request.headers.host || 'main',
		langs = null,
		protocol = '';

	// Getter for cookies
	function getCookies() {

		// Check if cookies are not already parsed
		if (!cookies) {
			cookies = utils.parseCookies(request);
		}

		return cookies;
	}

	// Getter for accepted language
	function getLangs() {

		// Check if languages are not already parsed
		if (!langs) {
			langs = utils.parseLangs(request);
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
		}
	});

	// Check for protocol type
	if (request.headers.upgrade) {
		protocol = 'ws';
	} else {
		protocol = 'http';
	}

	// Check for secured protocol
	if (request.connection.encrypted) {
		protocol += 's';
	}

	// Create and populate connection members
	this.headers = request.headers;
	this.ip = request.connection.remoteAddress;
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

// Transform method implementation
connection.prototype._transform = function (chunk, encoding, callback) {
	this.push(chunk);
	callback();
};

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