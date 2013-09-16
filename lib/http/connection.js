'use strict';

var fs = require('fs'),
	mime = require('../../utils/mime'),
	stream = require('stream'),
	url = require('url'),
	utils = require('../../utils/utils'),
	zlib = require('zlib');

// HTTP connection prototype constructor
var connection = function (host, request, response) {

	var cookies,
		encoding = request.headers['accept-encoding'],
		langs,
		protocol,
		session,
		that = this,
		wstream = response;

	// Write the session to the response
	function writeSession() {

		// Select the session key from cookies
		session = cookies._session;

		// Generate session if it does not exist
		if (!host.sessions[session]) {
			session = utils.generateSessionName();
			host.sessions[session] = {};
		}

		// Clear the previous timer and create a new one
		clearTimeout(host.timers[session]);
		host.timers[session] = setTimeout(function () {
			delete host.sessions[session];
			delete host.timers[session];
		}, host.conf.session * 1000);

		// Write the session cookie
		that.cookie('_session', session, {
			domain: that.host,
			expires: host.conf.session,
			httpOnly: true,
			path: '/'
		});
	}

	// Getter for cookies
	function getCookies() {

		// Parse cookies
		if (!cookies && request.headers.cookie) {
			cookies = utils.parseCookies(request.headers.cookie);
		} else {
			cookies = {};
		}

		return cookies;
	}

	// Getter for accepted language
	function getLangs() {

		// Parse languages
		if (!langs && request.headers['accept-language']) {
			langs = utils.parseLangs(request.headers['accept-language']);
		} else {
			langs = [];
		}

		return langs;
	}

	// Getter for session
	function getSession() {

		// Parse cookies
		if (!cookies && request.headers.cookie) {
			cookies = utils.parseCookies(request.headers.cookie);
		} else {
			cookies = {};
		}

		// Write session if it is not defined
		if (!session) {
			writeSession();
		}

		return host.sessions[session];
	}

	// Call events.EventEmitter in this context
	stream.Transform.call(this);

	// Define special properties for HTTP connection
	Object.defineProperties(this, {
		cookies: {
			enumerable: true,
			get: getCookies
		},
		langs: {
			enumerable: true,
			get: getLangs
		},
		request: {
			value: request
		},
		response: {
			value: response
		},
		session: {
			enumerable: true,
			get: getSession
		}
	});

	// Check for supported content encodings of the client
	if (encoding && host.conf.compression) {

		// Lower case for comparing
		encoding = encoding.toLowerCase();

		// Check for supported compression
		if (encoding.indexOf('deflate') >= 0) {
			encoding = 'deflate';
			wstream = zlib.Deflate();
		} else if (encoding.indexOf('gzip') >= 0) {
			encoding = 'gzip';
			wstream = zlib.Gzip();
		}

		// Check for successful compression selection
		if (wstream !== response) {
			response.setHeader('Content-Encoding', encoding);
			wstream.pipe(response);
		}
	}

	// Get the protocol
	if (request.connection.encrypted) {
		protocol = 'https://';
	} else {
		protocol = 'http://';
	}

	// The content body of the request
	this.body = '';

	// The files sent using POST method and multipart/form-data encoding
	this.files = {};

	// The headers of the request
	this.headers = request.headers;

	// The remote address of the request
	this.ip = request.connection.remoteAddress;

	// The method of the request
	this.method = request.method;

	// The named parameters of the route
	this.params = {};

	// The protocol of the request
	this.protocol = protocol.slice(0, -3);

	// The components of the request url
	this.url = url.parse(protocol + host.name + request.url, true);

	// The hostname from the host header
	this.host = this.url.hostname;

	// The pathname of the url of the request
	this.path = this.url.pathname;

	// The object containing queries from both GET and POST methods
	this.query = this.url.query;

	// Render from the template engine
	this.render = function (source, imports) {
		imports = imports || {};
		imports.connection = this;
		wstream.end(host.render(source, imports));
	};

	// Transform method implementation
	this._transform = function (chunk, encoding, callback) {
		this.push(chunk);
		callback();
	};

	// Pipe the connection to the response or compression stream
	this.pipe(wstream);
};

connection.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: connection
	}
});

// Set the cookie with specific options
connection.prototype.cookie = function (name, value, attributes) {

	var cookie = name + '=' + encodeURIComponent(value),
		cookies = this.response.getHeader('Set-Cookie') || [];

	// Use void object if no attributes defined
	attributes = attributes || {};

	// Use expires or max-age to set the expiration time of the cookie
	if (attributes.expires) {
		attributes.expires = Date.now() + attributes.expires * 1000;
		cookie += ';expires=' + new Date(attributes.expires).toUTCString();
	} else if (attributes.maxAge) {
		cookie += ';max-age=' + attributes.maxAge;
	}

	// Set the path from the configuration or use the root
	if (attributes.path) {

		// The path should begin with slash
		if (attributes.path.charAt(0) !== '/') {
			attributes.path = '/' + attributes.path;
		}

		cookie += ';path=' + attributes.path;
	}

	// Set the domain, by default is the current host
	if (attributes.domain) {

		// The domain should contain at least one dot
		if (attributes.domain.indexOf('.') < 0) {
			attributes.domain = '';
		}

		cookie += ';domain=' + attributes.domain;
	}

	// Set the secure flag of the cookie for the HTTPS protocol
	if (attributes.secure) {
		cookie += ';secure';
	}

	// Set the httpOnly flag of the cookie
	if (attributes.httpOnly) {
		cookie += ';httponly';
	}

	// Prepare the Set-Cookie header
	cookies.push(cookie);
	this.response.setHeader('Set-Cookie', cookies);

	return this;
};

// Write the content of a file to the response
connection.prototype.drain = function (location, type, override) {

	var stream = fs.createReadStream(location),
		that = this;

	// Set the content type of the file
	type = type || location.substr(location.lastIndexOf('.') + 1);
	this.type(type, override);

	// Check stream for errors
	stream.on('error', function (error) {
		that.emit('error', error);
	});

	// Pipe the content of the file to the connection stream
	stream.pipe(this);

	// On lost connection destroy the file read stream
	this.on('close', function () {
		stream.destroy();
	});
};

// Set the header of the response
connection.prototype.header = function (name, value) {
	this.response.setHeader(name, value);
	return this;
};

// Set the language of the content of the response
connection.prototype.lang = function (lang) {
	this.response.setHeader('Content-Language', lang);
	return this;
};

// Redirect the client to the specific location
connection.prototype.redirect = function (location, permanent) {

	// Set the status code and the location of the response
	this.response.writeHead(permanent && 301 || 302, {
		'Location': location
	});

	this.end();
};

// Send preformatted data to the response stream
connection.prototype.send = function (data, replacer, space) {

	// Transform data to Buffer and writes it to the stream
	if (!Buffer.isBuffer(data)) {

		// Stringify data if it is not a string
		if (typeof data !== 'string') {
			data = JSON.stringify(data, replacer, space);
		}

		// Create the buffer from the string if it exists
		data = new Buffer(data || 0);
	}

	this.end(data);
};

// Set the status code of the response
connection.prototype.status = function (code) {
	this.response.statusCode = code;
	return this;
};

// Set the type of the content of the response
connection.prototype.type = function (type, override) {

	// By default use the mime types from the provided list
	if (!override) {
		type = mime[type] || mime.unknown;

		// Append the charset for the text content type
		if (type.substr(0, type.indexOf('/')) === 'text') {
			type += ';charset=utf-8';
		}
	}

	this.response.setHeader('Content-Type', type);
	return this;
};

module.exports = connection;