'use strict';

var stream = require('stream'),
	url = require('url'),
	utils = require('simples/utils/utils');

// Abstract connection prototype constructor
var connection = function (host, request) {

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

				// Check if cookies are not already parsed
				if (!cookies.length && this.headers.cookie) {
					cookies = utils.parseCookies(this.headers.cookie);
				}

				return cookies;
			}
		},
		langs: {
			enumerable: true,
			get: function () {

				// Check if languages are not already parsed
				if (!langs.length && this.headers['accept-language']) {
					langs = utils.parseLangs(this.headers['accept-language']);
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

// Destroy the connection socket
connection.prototype.destroy = function () {
	this.socket.destroy();
};

// Log data
connection.prototype.log = function (stream, data) {

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
		data = data.toString();
	} else if (typeof data !== 'string') {
		data = JSON.stringify(data);
	}

	// Replace defined tokens
	data = data.replace(/%date\b/g, date.toString());
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
		console.log(data);
	}

	return this;
};

module.exports = connection;