'use strict';

var abstractConnection = require('simples/lib/connection'),
	fs = require('fs'),
	http = require('http'),
	mime = require('simples/utils/mime'),
	path = require('path'),
	utils = require('simples/utils/utils');

// HTTP connection prototype constructor
var connection = function (host, request, response) {

	// Call abstract connection in this context
	abstractConnection.call(this, host, request);

	// Define special properties for HTTP connection
	Object.defineProperties(this, {
		request: {
			value: request
		},
		response: {
			value: response
		}
	});

	// HTTP connection specific members
	this.body = {};
	this.files = {};
	this.method = request.method;
	this.params = {};
};

// Inherit from abstractConnection
connection.prototype = Object.create(abstractConnection.prototype, {
	constructor: {
		value: connection
	}
});

// Set the cookie with specific options
connection.prototype.cookie = function (name, value, attributes) {

	var cookie = name + '=' + encodeURIComponent(value),
		cookies = this.header('Set-Cookie');

	// Check for previously set cookies
	if (!cookies) {
		cookies = [];
	}

	// Use void object if no attributes defined
	if (!attributes || typeof attributes !== 'object') {
		attributes = {};
	}

	// Use expires or max-age to set the expiration time of the cookie
	if (attributes.expires) {
		cookie += ';expires=' + utils.utc(attributes.expires * 1000);
	} else if (attributes.maxAge) {
		cookie += ';max-age=' + attributes.maxAge;
	}

	// Set the path from the configuration or use the root
	if (attributes.path) {

		// Add the path attribute
		cookie += ';path=';

		// The path should begin with slash
		if (attributes.path[0] !== '/') {
			cookie += '/';
		}

		// Add the path value
		cookie += attributes.path;
	}

	// Set the domain, by default is the current host
	if (attributes.domain) {

		// Add the domain attribute
		cookie += ';domain=';

		// The domain should contain at least one dot
		if (attributes.domain.indexOf('.') >= 0) {
			cookie += attributes.domain;
		}
	}

	// Set the secure flag of the cookie for the HTTPS protocol
	if (this.socket.encrypted && attributes.secure !== false) {
		cookie += ';secure';
	}

	// Set the httpOnly flag of the cookie
	if (attributes.httpOnly) {
		cookie += ';httponly';
	}

	// Prepare the Set-Cookie header
	cookies.push(cookie);
	this.header('Set-Cookie', cookies);

	return this;
};

// Write the content of a file to the response
connection.prototype.drain = function (location, type, override) {

	var rstream = fs.createReadStream(location);

	// Check if the content type of the file is defined
	if (!type) {
		type = path.extname(location).substr(1);
	}

	// Set the content type of the file and listen for connection close
	this.type(type, override);

	// Pipe the content of the file to the connection stream
	rstream.pipe(this);
};

// Set or get the header of the response
connection.prototype.header = function (name, value) {

	// Set the header if the value is defined or return the header value
	if (typeof name === 'string') {
		if (value) {
			this.response.setHeader(name, value);
		} else if (value === null) {
			this.response.removeHeader(name);
		} else {
			return this.response.getHeader(name);
		}
	}

	return this;
};

// Set a timeout for inactivity on the connection socket
connection.prototype.keep = function (timeout) {

	// Check for a valid timeout and set a default value
	if (timeout === undefined) {
		timeout = 0;
	} else if (typeof timeout !== 'number' || timeout < 0) {
		timeout = 5000;
	}

	// Set the socket timeout
	this.socket.setTimeout(timeout);

	return this;
};

// Set or get the language of the content of the response
connection.prototype.lang = function (value) {

	// Check for a string value
	if (typeof value === 'string' || value === null) {
		this.header('Content-Language', value);
	} else {
		return this.header('Content-Language');
	}

	return this;
};

// Set or get the length of the content of the response
connection.prototype.length = function (value) {

	// Check for a number value
	if (typeof value === 'number' && value >= 0) {
		value = value | 0;
		this.header('Content-Length', value.toString());
	} else if (value === null) {
		this.header('Content-Length', null);
	} else {
		return this.header('Content-Length');
	}

	return this;
};

// Redirect the client to the specific location
connection.prototype.redirect = function (location, permanent) {

	var code = 302;

	// Set default location redirect
	if (typeof location !== 'string') {
		location = '/';
	}

	// Check for permanent redirect
	if (permanent === true) {
		code = 301;
	}

	// Set the status code, the redirect location and end the connection
	this.status(code).header('Location', location).end();
};

// Render from the template engine
connection.prototype.render = function (source, imports) {

	var engine = this.parent.tengine;

	// Set imports as an empty object if it is not
	if (!imports || typeof imports !== 'object') {
		imports = {};
	}

	// Inject connection to imports
	imports.connection = this;

	// Write the result to the response
	if (!engine) {
		console.error('\nsimpleS: No template engine defined\n');
		this.end('No template engine defined');
	} else {
		this.end(engine.render(source, imports));
	}
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
		if (data) {
			data = new Buffer(data);
		} else {
			data = new Buffer(0);
		}
	}

	// Write the data and end the connection
	this.end(data);
};

// Set or get the status code of the response
connection.prototype.status = function (code) {

	// Check for a valid status code
	if (typeof code === 'number' && http.STATUS_CODES[code]) {
		this.response.statusCode = code;
	} else {
		return this.response.statusCode;
	}

	return this;
};

// Set or get the type of the content of the response
connection.prototype.type = function (type, override) {

	// Check if the type is a string
	if (typeof type === 'string') {

		// Set the MIME type from the list or use application/octet-stream
		if (!override && mime[type]) {
			type = mime[type];
		}

		// Set type as application/octet-stream if it is not defined
		if (!type) {
			type = mime.unknown;
		}

		// Append the charset UTF-8 for the text content type
		if (!override && type.substr(0, type.indexOf('/')) === 'text') {
			type += ';charset=utf-8';
		}

		// Set the Content-Type header of the response
		this.header('Content-Type', type);
	} else if (type === null) {
		this.header('Content-Type', null);
	} else {
		return this.header('Content-Type');
	}

	return this;
};

module.exports = connection;