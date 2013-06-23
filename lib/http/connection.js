'use strict';

var events = require('events'),
	fs = require('fs'),
	mime = require('../../utils/mime'),
	url = require('url'),
	utils = require('../../utils/utils'),
	zlib = require('zlib');

var connection = function (host, request, response) {

	var cookies,
		encoding = request.headers['accept-encoding'],
		langs,
		parsedCookies,
		protocol,
		session,
		sessionWritten = false,
		that = this,
		wstream = response;

	// Getter for cookies
	function getCookies() {

		// Parse cookies
		if (!parsedCookies) {
			parsedCookies = utils.parseCookies(request);
			cookies = parsedCookies.cookies;
			session = parsedCookies.session;
		}

		return cookies;
	}

	// Getter for accepted language
	function getLangs() {

		// Parse languages
		if (!langs) {
			langs = utils.parseLangs(request);
		}

		return langs;
	}

	// Getter for session
	function getSession() {

		// Return session if it was written already to the response
		if (sessionWritten) {
			return host.sessions[session];
		}

		// Parse cookies
		if (!parsedCookies) {
			parsedCookies = utils.parseCookies(request);
			cookies = parsedCookies.cookies;
			session = parsedCookies.session;
		}

		// Generate session if it does not exist
		if (!host.sessions[session]) {
			session = utils.generateSessionName();
			host.sessions[session] = {};
		}

		// Write the session cookie to the response
		clearTimeout(host.timers[session]);
		host.timers[session] = setTimeout(function () {
			delete host.sessions[session];
			delete host.timers[session];
		}, 3600000);
		that.cookie('_session', session, {
			domain: that.host,
			expires: 3600,
			httpOnly: true,
			path: '/'
		});
		sessionWritten = true;

		return host.sessions[session];
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Get the protocol
	if (request.connection.encrypted) {
		protocol = 'https://';
	} else {
		protocol = 'http://';
	}

	// Check for supported content encodings of the client
	if (encoding) {

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
		if (encoding === 'deflate' || encoding === 'gzip') {
			response.setHeader('Content-Encoding', encoding);
			wstream.pipe(response);
		}
	}

	// Set special properties
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
	this.url = url.parse(protocol + request.headers.host + request.url, true);

	// The hostname from the host header
	this.host = this.url.hostname;

	// The pathname of the url of the request
	this.path = this.url.pathname;

	// The object containing queries from both GET and POST methods
	this.query = this.url.query;

	// Writable stream .end() method implementation
	this.end = function (chunk, encoding, callback) {
		wstream.end(chunk, encoding, callback);
	};

	// Render from the template engine
	this.render = function (source, imports) {
		wstream.end(host.render(source, imports));
	};

	// Writable stream .write() method implementation
	this.write = function (chunk, encoding, callback) {
		return wstream.write(chunk, encoding, callback);
	};

	// Emit events triggered by the response stream
	response.on('close', function () {
		that.emit('close');
	});

	response.on('drain', function () {
		that.emit('drain');
	});

	response.on('end', function () {
		that.emit('end');
	});

	response.on('error', function (error) {
		that.emit('error', error);
	});

	response.on('finish', function () {
		that.emit('finish');
	});

	// Set the default content type to html
	response.setHeader('Content-Type', 'text/html;charset=utf-8');
};

connection.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: connection,
		enumerable: false,
		writable: true,
		configurable: true
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
connection.prototype.drain = function (path) {
	fs.createReadStream(path).pipe(this);
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

// Redirect the client to the specific path
connection.prototype.redirect = function (path, permanent) {
	this.response.writeHead((permanent && 301) || 302, {
		'Location': path
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

// Set the type of the content of the response
connection.prototype.type = function (type, override) {

	// By default use the mime types from the provided list
	if (!override) {
		type = mime[type] || mime.unknown;
	}

	this.response.setHeader('Content-Type', type);
	return this;
};

module.exports = connection;