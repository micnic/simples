'use strict';

var abstractConnection = require('simples/lib/connection'),
	fs = require('fs'),
	http = require('http'),
	mime = require('simples/utils/mime'),
	utils = require('simples/utils/utils'),
	zlib = require('zlib');

// HTTP connection prototype constructor
var connection = function (host, request, response) {

	var config = host.conf,
		encoding = request.headers['accept-encoding'],
		wstream = response;

	// Call abstractConnection in this context
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

	// Check for supported content encodings of the client
	if (encoding && config.compression.enabled) {

		// Lower case for comparing
		encoding = encoding.toLowerCase();

		// Check for supported compression
		if (encoding.indexOf('deflate') >= 0) {
			encoding = 'deflate';
			wstream = zlib.Deflate(config.compression.options);
		} else if (encoding.indexOf('gzip') >= 0) {
			encoding = 'gzip';
			wstream = zlib.Gzip(config.compression.options);
		}

		// Check for successful compression selection
		if (wstream !== response) {
			response.setHeader('Content-Encoding', encoding);
			wstream.pipe(response);
		}
	}

	// Create and populate connection members
	this.body = {};
	this.files = {};
	this.method = request.method;
	this.params = {};

	// Pipe the connection to the response or compression stream
	this.pipe(wstream);
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
		cookies = this.response.getHeader('Set-Cookie') || [],
		params = {},
		socket = this.request.connection;

	// Use void object if no attributes defined
	if (typeof attributes === 'object') {
		params = {
			domain: attributes.domain,
			expires: attributes.expires,
			httpOnly: attributes.httpOnly,
			maxAge: attributes.maxAge,
			path: attributes.path,
			secure: attributes.secure
		};
	}

	// Use expires or max-age to set the expiration time of the cookie
	if (params.expires) {
		cookie += ';expires=' + utils.utc(params.expires * 1000);
	} else if (params.maxAge) {
		cookie += ';max-age=' + params.maxAge;
	}

	// Set the path from the configuration or use the root
	if (params.path) {

		// The path should begin with slash
		if (params.path[0] !== '/') {
			params.path = '/' + params.path;
		}

		cookie += ';path=' + params.path;
	}

	// Set the domain, by default is the current host
	if (params.domain) {

		// The domain should contain at least one dot
		if (params.domain.indexOf('.') < 0) {
			params.domain = '';
		}

		cookie += ';domain=' + params.domain;
	}

	// Set the secure flag of the cookie for the HTTPS protocol
	if (socket.encrypted && params.secure !== false) {
		cookie += ';secure';
	}

	// Set the httpOnly flag of the cookie
	if (params.httpOnly) {
		cookie += ';httponly';
	}

	// Prepare the Set-Cookie header
	cookies.push(cookie);
	this.response.setHeader('Set-Cookie', cookies);

	return this;
};

// Write the content of a file to the response
connection.prototype.drain = function (location, type, override) {

	var rstream = fs.createReadStream(location);

	// Set the content type of the file
	type = type || location.substr(location.lastIndexOf('.') + 1);
	this.type(type, override);

	// Pipe the content of the file to the connection stream
	rstream.pipe(this);

	// On lost connection destroy the file read stream
	this.on('close', function () {
		rstream.destroy();
	});
};

// Set the header of the response
connection.prototype.header = function (name, value) {

	// Check for string parameters
	if (typeof name === 'string' && typeof value === 'string') {
		this.response.setHeader(name, value);
	}

	return this;
};

// Set a timeout for inactivity on the connection socket
connection.prototype.keep = function (timeout) {

	var socket = this.response.connection;

	// Check for a valid timeout and set a default value
	if (typeof timeout === 'undefined') {
		timeout = 0;
	} else if (typeof timeout !== 'number') {
		timeout = 5000;
	}

	// Set the socket timeout
	socket.setTimeout(timeout);

	return this;
};

// Set the language of the content of the response
connection.prototype.lang = function (lang) {

	// Check for a string language
	if (typeof lang === 'string') {
		this.response.setHeader('Content-Language', lang);
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
	if (permanent && typeof permanent === 'boolean') {
		code = 301;
	}

	// Set the status code and the location of the response
	this.response.writeHead(code, {
		'Location': location
	});

	// End the connection
	this.end();
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
	} else if (engine.render.length === 1 || engine.render.length === 2) {
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
		data = new Buffer(data || 0);
	}

	// Write the data and end the connection
	this.end(data);
};

// Set the status code of the response
connection.prototype.status = function (code) {

	// Check for a valid status code
	if (typeof code === 'number' && http.STATUS_CODES[code]) {
		this.response.statusCode = code;
	}

	return this;
};

// Set the type of the content of the response
connection.prototype.type = function (type, override) {

	// Check if the type is not overridden
	if (!override) {

		// Set the MIME type from the list or use application/octet-stream
		type = mime[type] || mime.unknown;

		// Append the charset UTF-8 for the text content type
		if (type.substr(0, type.indexOf('/')) === 'text') {
			type += ';charset=utf-8';
		}
	}

	// Set the Content-Type header of the response
	this.response.setHeader('Content-Type', type);

	return this;
};

module.exports = connection;