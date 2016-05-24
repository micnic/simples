'use strict';

var AbstractConnection = require('simples/lib/abstract-connection'),
	Form = require('simples/lib/http/form'),
	fs = require('fs'),
	http = require('http'),
	mime = require('mime.json'),
	path = require('path'),
	utils = require('simples/utils/utils'),
	zlib = require('zlib');

// HTTP connection prototype constructor
var HttpConnection = function (host, request, response) {

	// Call AbstractConnection in this context
	AbstractConnection.call(this, host, request);

	// Define private properties for HTTP connection
	Object.defineProperties(this, {
		enabled: {
			value: true,
			writable: true
		},
		started: {
			value: false,
			writable: true
		}
	});

	// HTTP connection specific members
	this.method = request.method;
	this.request = request;
	this.response = response;
};

// HTTP connection factory function
HttpConnection.create = function (host, request, response) {

	return new HttpConnection(host, request, response);
};

// Inherit from AbstractConnection
HttpConnection.prototype = Object.create(AbstractConnection.prototype, {
	constructor: {
		value: HttpConnection
	}
});

// Flush method implementation
HttpConnection.prototype._flush = function (callback) {

	// Emit start before the first write
	if (!this.started) {
		this._start();
	}

	// End the connection
	callback();
};

// Configure the connection before writing the first chunk of data
HttpConnection.prototype._start = function () {

	var acr = {},
		config = this.parent.options,
		compression = config.compression,
		cors = config.cors,
		deflate = false,
		encoding = this.headers['accept-encoding'],
		gzip = false,
		headers = null,
		methods = null,
		origin = this.headers.origin,
		type = this.type(),
		wstream = this.response;

	// Set the default content type if it is not defined
	if (!type) {
		this.type('html');
		type = this.type();
	}

	// Check for CORS requests
	if (origin) {

		// Check if the origin is accepted
		if (utils.accepts(this, cors.origins)) {

			// Prepare CORS specific response headers
			acr.headers = this.headers['access-control-request-headers'];
			acr.methods = this.headers['access-control-request-method'];

			// Check to allow CORS credentials
			if (cors.credentials) {
				this.header('Access-Control-Allow-Credentials', 'True');
			}

			// Select the allowed headers
			if (cors.headers.length) {
				headers = cors.headers.join(',');
			} else if (acr.headers) {
				headers = acr.headers;
			}

			// Set the allowed headers
			if (headers) {
				this.header('Access-Control-Allow-Headers', headers);
			}

			// Select the allowed methods
			if (cors.methods.length) {
				methods = cors.methods.join(',');
			} else if (acr.methods) {
				methods = acr.methods;
			}

			// Set the allowed methods
			if (methods) {
				this.header('Access-Control-Allow-Methods', methods);
			}
		} else {
			origin = this.protocol + '://' + this.host;
			this.enabled = false;
		}

		// Set the accepted origin
		this.header('Access-Control-Allow-Origin', origin);
	}

	// Check for supported content encodings of the client
	if (encoding && compression.enabled && compression.filter.test(type)) {

		// Get accepted encodings
		deflate = /deflate/i.test(encoding);
		gzip = /gzip/i.test(encoding);

		// Check for supported compression
		if (deflate && (compression.preferred === 'deflate' || !gzip)) {
			encoding = 'Deflate';
			wstream = zlib.Deflate(compression.options);
		} else if (gzip && (compression.preferred === 'gzip' || !deflate)) {
			encoding = 'Gzip';
			wstream = zlib.Gzip(compression.options);
		}

		// Check for successful compression selection
		if (wstream !== this.response) {
			this.header('Content-Encoding', encoding);
			wstream.pipe(this.response);
		}
	}

	// Set the started flag
	this.started = true;

	// Pipe the connection to the compress stream or the response stream
	this.pipe(wstream);
};

// Transform method implementation
HttpConnection.prototype._transform = function (chunk, encoding, callback) {

	// Emit start before the first write
	if (!this.started) {
		this._start();
	}

	// Push the chunk to the stack if the connection is enabled
	if (this.enabled) {
		this.push(chunk);
	}

	// End current transform
	callback();
};

// Set, get or remove Cache-Control header
HttpConnection.prototype.cache = function (options) {

	var header = 'private';

	// Check for the value of the options argument
	if (options === null) {
		this.header('Cache-Control', null);
	} else if (typeof options === 'string') {
		this.header('Cache-Control', options);
	} else if (typeof options === 'object') {

		// Switch to public cache type
		if (options.type === 'public') {
			header = 'public';
		}

		// Add max age value to the header
		if (typeof options.maxAge === 'number' && options.maxAge > 0) {
			header += ', max-age=' + options.maxAge;
		}

		// Add shared max age value to the header
		if (typeof options.sMaxAge === 'number' && options.smaxAge > 0) {
			header += ', s-maxage=' + options.smaxAge;
		}

		// Set Cache-Control header
		this.header('Cache-Control', header);
	} else if (!arguments.length) {
		return this.header('Cache-Control');
	}

	return this;
};

// Set a cookie
HttpConnection.prototype.cookie = function (name, value, attributes) {

	var cookie = name + '=' + encodeURIComponent(value);

	// Prepare attributes
	attributes = utils.assign({}, attributes);

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
		if (/\./.test(attributes.domain)) {
			cookie += attributes.domain;
		}
	}

	// Set the secure flag of the cookie for the HTTPS protocol
	if (this.socket.encrypted && attributes.secure) {
		cookie += ';secure';
	}

	// Set the httpOnly flag of the cookie
	if (attributes.httpOnly) {
		cookie += ';httponly';
	}

	// Add the cookie in the header
	this.header('Set-Cookie', (this.header('Set-Cookie') || []).concat(cookie));

	return this;
};

// Write the content of a file to the response
HttpConnection.prototype.drain = function (location, type, override) {

	// Make type and override parameters optional
	if (typeof type !== 'string') {
		type = path.extname(location).substr(1);
		override = false;
	}

	// Set the content type of the file
	this.type(type, override);

	// Pipe the content of the file to the connection stream
	fs.ReadStream(location).pipe(this);
};

// Set, get or remove a header of the response
HttpConnection.prototype.header = function (name, value) {

	// Set the header if the value is defined or return the header value
	if (typeof name === 'string') {

		// Stringify boolean and numeric values
		if (typeof value === 'boolean' || typeof value === 'number') {
			value = String(value);
		}

		// Get, set or remove header depending on the value received
		if (Array.isArray(value) || typeof value === 'string') {
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
HttpConnection.prototype.keep = function (timeout) {

	// Check for a valid timeout and set a default value
	if (typeof timeout !== 'number' || timeout < 0) {
		timeout = 0;
	}

	// Set the socket timeout
	this.socket.setTimeout(timeout);

	return this;
};

// Set or get the language of the content of the response
HttpConnection.prototype.lang = function (value) {

	// Check for a string value
	if (typeof value === 'string' || value === null) {
		this.header('Content-Language', value);
	} else {
		return this.header('Content-Language');
	}

	return this;
};

// Define the relation of the current location with other locations
HttpConnection.prototype.link = function (links) {

	var values = [];

	// Validate links object and set the headers
	if (links === null) {
		this.header('Link', null);
	} else if (links && typeof links === 'object') {

		// Prepare the headers values
		values = utils.map(links, function (relation) {
			return '<' + links[relation] + '>; rel="' + relation + '"';
		}).join(', ');

		// Set the 'Link' headers
		this.header('Link', values);
	} else if (!arguments.length) {
		return this.header('Link');
	}

	return this;
};

// Parse received data from the request
HttpConnection.prototype.parse = function (config) {

	var form = Form.create(this.request, config);

	// Expose the parsing results to the corresponding callback function
	if (config && typeof config === 'object') {
		if (typeof config[form.type] === 'function') {
			if (form.type === 'json' || form.type === 'urlencoded') {
				form.on('end', function () {
					config[form.type](null, form.result);
				}).on('error', function (error) {
					config[form.type](error);
				});
			} else {
				config[form.type](form);
			}
		} else if (typeof config.plain === 'function') {
			config.plain(form);
		}
	}

	return this;
};

// Redirect the client to a specific location
HttpConnection.prototype.redirect = function (location, permanent) {

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
HttpConnection.prototype.render = function (source, imports) {

	var engine = this.parent.tengine,
		that = this;

	// Prepare the imports and inject the connection object
	imports = utils.assign({
		connection: this
	}, imports);

	// Write the result to the response
	if (engine) {
		if (engine.render.length === 3) {
			engine.render(source, imports, function (result) {
				that.end(result);
			});
		} else if (engine.render.length < 3) {
			this.end(engine.render(source, imports));
		}
	} else {
		this.end('No template engine defined');
	}
};

// Send preformatted data to the response stream
HttpConnection.prototype.send = function (data, replacer, space) {

	// Prepare received data
	if (Buffer.isBuffer(data)) {

		// Set application/octet-stream content type if it is not defined
		if (!this.type()) {
			this.type('unknown');
		}
	} else if (typeof data !== 'string') {

		// Set application/json content type if it is not defined
		if (!this.type()) {
			this.type('json');
		}

		// Stringify non-string data
		data = JSON.stringify(data, replacer, space);
	}

	// Write the data and end the connection
	this.end(data);
};

// Set or get the status code of the response
HttpConnection.prototype.status = function (code) {

	// Check for a valid status code
	if (typeof code === 'number' && http.STATUS_CODES[code]) {
		this.response.statusCode = code;
	} else {
		return this.response.statusCode;
	}

	return this;
};

// Set, get or remove the type of the content of the response
HttpConnection.prototype.type = function (type, override) {

	// Check if the type is a string
	if (typeof type === 'string') {

		// Set the MIME type from the list
		if (override !== true) {

			// Use lower case for comparing content type
			type = type.toLowerCase();

			// Check if the MIME type is defined in the list
			if (mime[type]) {
				type = mime[type];
			} else {
				type = 'application/octet-stream';
			}

			// Append the charset UTF-8 for the text content type
			if (/^text\/.+$/.test(type)) {
				type += ';charset=utf-8';
			}
		}

		// Set the Content-Type header of the response
		this.header('Content-Type', type);
	} else if (type === null) {
		this.header('Content-Type', null);
	} else if (!arguments.length) {
		return this.header('Content-Type');
	}

	return this;
};

module.exports = HttpConnection;