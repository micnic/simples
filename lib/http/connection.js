'use strict';

const AbstractConnection = require('simples/lib/abstract-connection');
const Args = require('simples/lib/utils/args');
const Config = require('simples/lib/utils/config');
const fs = require('fs');
const Form = require('simples/lib/http/form');
const mime = require('mime.json');
const path = require('path');
const QValueParser = require('simples/lib/parsers/q-value-parser');
const TimeFormatter = require('simples/lib/utils/time-formatter');
const zlib = require('zlib');

const foundCode = 302; // 302 HTTP status code
const movedPermanentlyCode = 301; // 301 HTTP status code

const logTypes = [
	'string',
	'object',
	'function'
];

class HTTPConnection extends AbstractConnection {

	constructor(router, location, request, response) {

		super(router, location, request);

		// Define HTTP connection public properties
		this.method = request.method;
		this.response = response;

		// Define HTTP connection private properties
		this._enabled = true;
		this._started = false;
	}

	// Flush method implementation
	_flush(callback) {

		// Prepare the HTTP connection before the first write
		if (!this._started) {
			HTTPConnection.start(this);
		}

		// End the connection
		callback();

		// Execute actions after the connection has ended
		HTTPConnection.finish(this);
	}

	// Transform method implementation
	_transform(chunk, encoding, callback) {

		// Prepare the HTTP connection before the first write
		if (!this._started) {
			HTTPConnection.start(this);
		}

		// Push the chunk to the stack only if the connection is enabled
		if (this._enabled) {
			this.push(chunk);
		}

		// End current transform
		callback();
	}

	// Set, get or remove Cache-Control header
	cache(config) {

		let header = 'private';

		// Check for the value of the options argument
		if (config === null) {
			this.header('Cache-Control', null);
		} else if (typeof config === 'string') {
			this.header('Cache-Control', config);
		} else if (typeof config === 'object') {

			// Switch to public cache type
			if (config.type === 'public') {
				header = 'public';
			}

			// Add max age value to the header
			if (typeof config.maxAge === 'number' && config.maxAge > 0) {
				header += `, max-age=${config.maxAge}`;
			}

			// Add shared max age value to the header
			if (typeof config.sMaxAge === 'number' && config.smaxAge > 0) {
				header += `, s-maxage=${config.smaxAge}`;
			}

			// Set Cache-Control header
			this.header('Cache-Control', header);
		} else if (arguments.length === 0) {
			return this.header('Cache-Control');
		}

		return this;
	}

	// Close the connection
	close(callback) {
		if (typeof callback === 'function') {
			this.end(callback);
		} else {
			this.end();
		}
	}

	// Set a cookie
	cookie(name, value, attributes) {

		let cookie = `${name}=${encodeURIComponent(value)}`;
		let cookies = this.header('Set-Cookie');

		// Prepare attributes
		attributes = Object.assign({}, attributes);

		// Use expires or max-age to set the expiration time of the cookie
		if (attributes.expires) {
			cookie += `;expires=${TimeFormatter.utcFormat(attributes.expires)}`;
		} else if (attributes.maxAge) {
			cookie += `;max-age=${attributes.maxAge}`;
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

		// If no cookies were defined before initialize the cookies list
		if (!cookies) {
			cookies = [];
		}

		// Add the current cookie to the cookies list
		cookies.push(cookie);

		// Update "Set-Cookie" header
		this.header('Set-Cookie', cookies);

		return this;
	}

	// Write the content of a file to the response
	drain(location, type, override) {

		// Make type and override parameters optional
		if (typeof type !== 'string') {
			type = path.extname(location).substr(1);
			override = false;
		}

		// Set the content type of the file
		this.type(type, override);

		// Pipe the content of the file to the connection stream
		// In Node 10+ use stream.pipeline()
		fs.ReadStream(location).pipe(this);
	}

	// Calls the error route with the provided code
	error(code) {

		let parentRouter = this._router;

		// Search in the router chain for a router to handle the error code
		while (parentRouter && !parentRouter._errors.has(code)) {
			parentRouter = parentRouter._parent;
		}

		// Check if connection has not started and available parent router
		if (!this._started && parentRouter) {

			// Set the provided status code
			this.status(code);

			// Call the parent router error listener
			parentRouter._errors.get(code).call(parentRouter, this);
		} else {
			this.destroy();
		}
	}

	// Set, get or remove a header of the response
	header(name, value) {

		// Set the header if the value is defined or return the header value
		if (typeof name === 'string') {

			// Stringify boolean and numeric values
			if (typeof value === 'boolean' || typeof value === 'number') {
				value = String(value);
			}

			// Get, set or remove header depending on the value received
			if (typeof value === 'string' || Array.isArray(value)) {
				this.response.setHeader(name, value);
			} else if (value === null) {
				this.response.removeHeader(name);
			} else {
				return this.response.getHeader(name);
			}
		}

		return this;
	}

	// Set a timeout for inactivity on the connection socket
	keep(timeout) {

		// Check for a valid timeout and set a default value
		if (typeof timeout !== 'number' || timeout < 0) {
			timeout = 0;
		}

		// Set the socket timeout
		this.socket.setTimeout(timeout);

		return this;
	}

	// Set or get the language of the content of the response
	lang(value) {

		// Check for a string value
		if (typeof value === 'string' || value === null) {
			this.header('Content-Language', value);
		} else {
			return this.header('Content-Language');
		}

		return this;
	}

	// Define the relation of the current location with other locations
	link(links) {

		// Validate links object and set the headers
		if (links === null) {
			this.header('Link', null);
		} else if (links && typeof links === 'object') {
			this.header('Link', Object.keys(links).map((key) => {
				return `<${links[key]}>; rel="${key}"`;
			}).join(', '));
		} else if (arguments.length === 0) {
			return this.header('Link');
		}

		return this;
	}

	// Log data
	log(format, tokens, logger) {

		// Make arguments optional
		[
			format,
			tokens,
			logger
		] = Args.getArgs(logTypes, format, tokens, logger);

		// Set default format
		if (!format) {
			format = '%short-date %time %protocol %method %href';
		}

		// Stringify buffer data
		if (Buffer.isBuffer(format)) {
			format = String(format);
		}

		// Stringify any other type of data
		if (typeof format !== 'string') {
			format = JSON.stringify(format);
		}

		// Replace HTTP connection related properties
		format = format.replace(/%lang\b/g, this.lang());
		format = format.replace(/%method\b/g, this.method);
		format = format.replace(/%status\b/g, this.status());
		format = format.replace(/%type\b/g, this.type());

		// Replace request headers
		format = format.replace(/%req\[([^\]]+)]\b/g, (match, header) => {
			return this.request.headers[header];
		});

		// Replace response headers
		format = format.replace(/%res\[([^\]]+)]\b/g, (match, header) => {
			return this.response.getHeader(header);
		});

		// Call abstract connection log to cover all available tokens
		super.log(format, tokens, logger);
	}

	// Parse received data from the request
	parse(config) {

		// Check for options to start parsing the form
		if (config && typeof config === 'object') {
			Form.parse(this.request, config);
		}

		return this;
	}

	// Redirect the client to a specific location
	redirect(location, permanent) {

		let code = foundCode;

		// Check for permanent argument
		if (permanent === true) {
			code = movedPermanentlyCode;
		}

		// Set default location redirect
		if (typeof location !== 'string') {
			location = '/';
		}

		// Set the status code, the redirect location and end the connection
		this.status(code).header('Location', location).end();
	}

	// Render from the template engine
	render(source, imports, callback) {

		const renderEngine = this._host._engine;

		// Prepare the imports and inject the connection object
		imports = Object.assign({
			connection: this
		}, imports);

		// Ensure that the callback is a function
		if (typeof callback !== 'function') {
			callback = null;
		}

		// Write the result to the response
		if (renderEngine) {
			renderEngine.render(source, imports, (result) => {
				this.end(result, callback);
			});
		} else {
			this.end('No template engine defined', callback);
		}
	}

	// Send preformatted data to the response stream
	send(data, callback) {

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
			data = JSON.stringify(data);
		}

		// Ensure that the callback is a function
		if (typeof callback !== 'function') {
			callback = null;
		}

		// Write the data and end the connection
		this.end(data, callback);
	}

	// Set or get the status code of the response
	status(code) {

		// Check for a valid status code
		if (typeof code === 'number') {
			this.response.statusCode = Math.floor(code);
		} else {
			return this.response.statusCode;
		}

		return this;
	}

	// Set, get or remove the type of the content of the response
	type(type, override) {

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
				if (type.startsWith('text/')) {
					type += ';charset=utf-8';
				}
			}

			// Set the Content-Type header of the response
			this.header('Content-Type', type);
		} else if (type === null) {
			this.header('Content-Type', null);
		} else if (arguments.length === 0) {
			return this.header('Content-Type');
		}

		return this;
	}

	// Apply compression on the provided connection
	static applyCompression(connection, compression) {

		let responseStream = connection.response;

		// Check for enabled compression and filter connection
		if (Config.isEnabled(compression.enabled, connection)) {

			const header = connection.headers['accept-encoding'];
			const encodings = QValueParser.parse(header, true);

			let encoding = null;

			// Check for accepted encoding
			if (encodings.includes(compression.preferred)) {
				if (compression.preferred === 'deflate') {
					encoding = 'Deflate';
				} else {
					encoding = 'Gzip';
				}
			} else if (encodings.includes('deflate')) {
				encoding = 'Deflate';
			} else if (encodings.includes('gzip')) {
				encoding = 'Gzip';
			}

			// Check for encoding to set the header and prepare the response
			if (encoding) {
				connection.header('Content-Encoding', encoding);
				responseStream = zlib[encoding](compression.options);

				// In Node 10+ use stream.pipeline()
				responseStream.pipe(connection.response);
			}
		}

		// Pipe the connection to the response stream
		// In Node 10+ use stream.pipeline()
		connection.pipe(responseStream);
	}

	// Apply CORS on the provided connection
	static applyCORS(connection, cors) {

		let origin = connection.headers.origin;

		// Check if the origin is accepted
		if (HTTPConnection.isAccepted(connection, cors.origins)) {

			let headers = connection.headers['access-control-request-headers'];
			let methods = connection.headers['access-control-request-method'];

			// Check to allow CORS credentials
			if (cors.credentials) {
				connection.header('Access-Control-Allow-Credentials', 'True');
			}

			// Select the allowed headers
			if (cors.headers.length) {
				headers = cors.headers.join(',');
			}

			// Set the allowed headers
			if (headers) {
				connection.header('Access-Control-Allow-Headers', headers);
			}

			// Select the allowed methods
			if (cors.methods.length) {
				methods = cors.methods.join(',');
			}

			// Set the allowed methods
			if (methods) {
				connection.header('Access-Control-Allow-Methods', methods);
			}
		} else {
			origin = `${connection.protocol}://${connection.host}`;
			connection._enabled = false;
		}

		// Set the accepted origin
		connection.header('Access-Control-Allow-Origin', origin);
	}

	// Apply logger on the provided connection
	static applyLogger(connection, logger) {

		// Check for enabled logger to log the connection
		if (Config.isEnabled(logger.enabled, connection)) {
			connection.log(logger.format, logger.tokens, logger.log);
		}
	}

	// Execute actions after the connection has ended
	static finish(connection) {

		const { logger } = connection._router._options;

		// Apply logger
		HTTPConnection.applyLogger(connection, logger);
	}

	// Prepare connection for writing process
	static start(connection) {

		const { compression, cors, timeout } = connection._router._options;

		// Set the default content type if it is not defined
		if (!connection.type()) {
			connection.type('html');
		}

		// Check for CORS requests
		if (connection.headers.origin) {
			HTTPConnection.applyCORS(connection, cors);
		}

		// Check for requests accepting compressed response
		if (connection.headers['accept-encoding']) {
			HTTPConnection.applyCompression(connection, compression);
		} else {

			// In Node 10+ use stream.pipeline()
			connection.pipe(connection.response);
		}

		// Set the connection keep alive timeout from router options
		if (Config.isEnabled(timeout.enabled, connection)) {
			connection.keep(timeout.value);
		}

		// Set the started flag
		connection._started = true;
	}
}

module.exports = HTTPConnection;