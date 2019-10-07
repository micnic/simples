'use strict';

const { ReadStream } = require('fs');
const {
	STATUS_CODES
} = require('http');
const { extname } = require('path');
const AbstractConnection = require('simples/lib/abstract-connection');
const Body = require('simples/lib/http/body');
const Form = require('simples/lib/http/form');
const QValueParser = require('simples/lib/parsers/q-value-parser');
const Config = require('simples/lib/utils/config');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const TimeFormatter = require('simples/lib/utils/time-formatter');
const TypeUtils = require('simples/lib/utils/type-utils');
const zlib = require('zlib');

const { isArray } = Array;
const { stringify } = JSON;
const { floor } = Math;
const { assign, keys } = Object;

const foundCode = 302; // 302 HTTP status code
const movedPermanentlyCode = 301; // 301 HTTP status code

const defaultLogFormat = '%short-date %time %protocol %method %href';

class HTTPConnection extends AbstractConnection {

	/**
	 * HTTPConnection constructor
	 * @param {Router} router
	 * @param {string} location
	 * @param {IncomingMessage} request
	 * @param {ServerResponse} response
	 */
	constructor(router, location, request, response) {

		super(router, location, request);

		// Define HTTP connection public properties
		this.method = request.method;
		this.response = response;

		// Define HTTP connection private properties
		this._enabled = true;
		this._failed = false;
		this._started = false;
	}

	/**
	 * Flush method implementation
	 * @param {Callback} callback
	 */
	_flush(callback) {

		// Prepare the HTTP connection before the first write
		if (!this._started) {
			HTTPConnection.start(this);
		}

		// Execute finish actions and end the connection
		HTTPConnection.finish(this, callback);
	}

	/**
	 * Transform method implementation
	 * @param {string|Buffer} chunk
	 * @param {string} encoding
	 * @param {Callback} callback
	 */
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

	/**
	 * Parse received data from the request
	 * @returns {Body}
	 */
	body() {

		return new Body(this.request);
	}

	/**
	 * Set, get or remove Cache-Control header
	 * @param {null|string|StringContainer} config
	 * @returns {string|this}
	 */
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

	/**
	 * Close the connection
	 * @param {Callback} callback
	 */
	close(callback) {
		if (typeof callback === 'function') {
			this.end(callback);
		} else {
			this.end();
		}
	}

	/**
	 * Set a cookie
	 * @param {string} name
	 * @param {string} value
	 * @param {CookieAttributes} attributes
	 * @returns {this}
	 */
	cookie(name, value, attributes) {

		let cookie = `${name}=${encodeURIComponent(value)}`;
		let cookies = this.header('Set-Cookie');

		// Prepare attributes
		// TODO: use object spread in Node 10+
		attributes = assign({}, attributes);

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

	/**
	 * Write the content of a stream or of a file to the response
	 * @param {string|fs.ReadStream} source
	 * @param {string} type
	 * @param {boolean} override
	 */
	drain(source, type, override) {

		// Stream the data from the source to the connection
		if (typeof source === 'string') {

			// Get content type from file path if type is not provided
			if (typeof type === 'string') {
				this.type(type, override);
			} else {
				this.type(extname(source));
			}

			// Pipe the content of the file to the connection stream
			// TODO: In Node 10+ use stream.pipeline()
			ReadStream(source).pipe(this);
		} else {

			// Set the content type of the stream
			if (typeof type === 'string') {
				this.type(type, override);
			}

			// Pipe the content of the source stream to the connection stream
			// TODO: In Node 10+ use stream.pipeline()
			source.pipe(this);
		}
	}

	/**
	 * Calls the error route with the provided code
	 * @param {number} code
	 */
	error(code) {

		let errorListener = null;
		let parentRouter = this._router;

		// Search in the router chain for a router to handle the error code
		while (parentRouter && !parentRouter._errors.has(code)) {
			parentRouter = parentRouter._parent;
		}

		// Check for parent router to select error listener
		if (parentRouter && parentRouter._errors.has(code)) {
			errorListener = parentRouter._errors.get(code);
		} else if (STATUS_CODES[code]) {
			errorListener = (connection) => {
				connection.end(STATUS_CODES[code]);
			};
		}

		// Check if connection has not started and available parent router
		if (!this._started && errorListener) {

			// Set the provided status code
			this.status(code);

			// Call the parent router error listener
			errorListener.call(parentRouter, this);
		} else {
			this.destroy();
		}
	}

	/**
	 * Parse multipart form data from request body
	 * @returns {Promise<Form>}
	 */
	form() {

		return Form.from(this.request);
	}

	/**
	 * Set, get or remove a header of the response
	 * @param {string} name
	 * @param {null|boolean|number|string|string[]} value
	 * @returns {string|this}
	 */
	header(name, value) {

		// Set the header if the value is defined or return the header value
		if (typeof name === 'string') {

			// Stringify boolean and numeric values
			if (typeof value === 'boolean' || typeof value === 'number') {
				value = String(value);
			}

			// Get, set or remove header depending on the value received
			if (typeof value === 'string' || isArray(value)) {
				this.response.setHeader(name, value);
			} else if (value === null) {
				this.response.removeHeader(name);
			} else {
				return this.response.getHeader(name);
			}
		}

		return this;
	}

	/**
	 * Set a timeout for inactivity on the connection socket
	 * @param {number} timeout
	 * @returns {this}
	 */
	keep(timeout) {

		// Check for a valid timeout and set a default value
		if (typeof timeout !== 'number' || timeout < 0) {
			timeout = 0;
		}

		// Set the socket timeout
		this.socket.setTimeout(timeout);

		return this;
	}

	/**
	 * Get, set or remove the content language of the response
	 * @param {null|string} value
	 * @returns {string|this}
	 */
	lang(value) {

		// Return content language if no arguments provided
		if (arguments.length === 0) {
			return this.header('Content-Language');
		}

		return this.header('Content-Language', value);
	}

	/**
	 * Define the relation of the current location with other locations
	 * @param {null|StringContainer} links
	 * @returns {string|this}
	 */
	link(value) {

		// Return link header if no arguments provided
		if (arguments.length === 0) {
			return this.header('Link');
		}

		let links = value;

		// Check for links object container
		if (links && typeof links === 'object') {
			links = keys(links).map((key) => {
				return `<${links[key]}>; rel="${key}"`;
			}).join(', ');
		}

		return this.header('Link', links);
	}

	/**
	 * Log data
	 * @param {string} format
	 * @param {Tokens} tokens
	 * @param {StringCallback} logger
	 * @returns {this}
	 */
	log(format, tokens, logger) {

		const args = {
			format: defaultLogFormat,
			logger: null,
			tokens: {}
		};

		if (typeof format === 'string') {
			args.format = format;

			if (typeof tokens === 'object') {
				args.tokens = tokens;

				if (typeof logger === 'function') {
					args.logger = logger;
				}
			} else if (typeof tokens === 'function') {
				args.logger = tokens;
			}
		} else if (typeof format === 'object') {
			args.tokens = format;

			if (typeof tokens === 'function') {
				args.logger = tokens;
			}
		} else if (typeof format === 'function') {
			args.logger = format;
		}

		// Replace HTTP connection related properties
		args.format = args.format.replace(/%lang\b/g, this.lang());
		args.format = args.format.replace(/%method\b/g, this.method);
		args.format = args.format.replace(/%status\b/g, this.status());
		args.format = args.format.replace(/%type\b/g, this.type());

		// Replace request headers
		args.format = args.format.replace(/%req\[([^\]]+)]\b/g, (match, header) => {
			return this.request.headers[header];
		});

		// Replace response headers
		args.format = args.format.replace(/%res\[([^\]]+)]\b/g, (match, header) => {
			return this.response.getHeader(header);
		});

		return super.log(args.format, args.tokens, args.logger);
	}

	/**
	 * Redirect the client to a specific location
	 * @param {string} location
	 * @param {boolean} permanent
	 */
	redirect(location, permanent) {

		let code = foundCode;

		// Check for permanent argument
		if (permanent === true) {
			code = movedPermanentlyCode;
		}

		// Set status code
		this.status(code);

		// Set the redirect location header
		if (typeof location === 'string') {
			this.header('Location', location);
		} else {
			this.header('Location', '/');
		}

		// End the connection
		this.end();
	}

	/**
	 * Render from the template engine
	 * @param {string} source
	 * @param {*} imports
	 */
	render(source, imports) {

		const engine = this._host._engine;

		// Write the result to the response
		if (engine) {
			// TODO: use object spread in Node 10+
			engine.render(source, assign({
				connection: this
			}, imports), (result) => {
				this.end(result);
			});
		} else {
			this.end('No template engine defined');
		}
	}

	/**
	 * Send data to the response stream
	 * @param {*} data
	 */
	send(data) {

		// Prepare received data
		if (typeof data === 'string') {
			this.end(data);
		} else if (Buffer.isBuffer(data)) {

			// Set application/octet-stream content type if it is not defined
			if (!this.type()) {
				this.type('bin');
			}

			// Write the data and end connection
			this.end(data);
		} else {

			// Set application/json content type if it is not defined
			if (!this.type()) {
				this.type('json');
			}

			// Stringify non-string data, write the data and end connection
			this.end(stringify(data));
		}
	}

	/**
	 * Get or set the status code of the response
	 * @param {number} code
	 * @returns {number|this}
	 */
	status(code) {

		// Check for a valid status code
		if (typeof code === 'number') {
			this.response.statusCode = floor(code);
		} else {
			return this.response.statusCode;
		}

		return this;
	}

	/**
	 * Get, set or remove the content type of the response
	 * @param {null|string} value
	 * @param {boolean} override
	 * @returns {string|this}
	 */
	type(value, override) {

		// Return content type if no arguments provided
		if (arguments.length === 0) {
			return this.header('Content-Type');
		}

		let type = value;

		// Check for string content type and no override
		if (typeof type === 'string' && override !== true) {
			type = TypeUtils.getContentType(type);
		}

		return this.header('Content-Type', type);
	}

	/**
	 * Apply compression on the provided connection
	 * @param {HTTPConnection} connection
	 * @param {RouterCompressionOptions} compression
	 */
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

	//
	/**
	 * Apply CORS on the provided connection
	 * @param {HTTPConnection} connection
	 * @param {RouterCORSOptions} cors
	 */
	static applyCORS(connection, cors) {

		let { origin } = connection.headers;

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

	/**
	 * Apply logger on the provided connection
	 * @param {HTTPConnection} connection
	 * @param {RouterLoggerOptions} logger
	 */
	static applyLogger(connection, logger) {

		// Check for enabled logger to log the connection
		if (Config.isEnabled(logger.enabled, connection)) {
			connection.log(logger.format, logger.tokens, logger.log);
		}
	}

	/**
	 * Apply session on the provided connection
	 * @param {HTTPConnection} connection
	 * @param {Session} session
	 * @returns {Promise<void>}
	*/
	static applySession(connection, session) {

		// Check for enabled session for the connection
		if (Config.isEnabled(session.enabled, connection)) {
			return connection.session.save();
		}

		return Promise.resolve();
	}

	/**
	 * Execute actions after the connection has ended
	 * @param {HTTPConnection} connection
	 * @param {() => void} callback
	 */
	static async finish(connection, callback) {

		const { logger, session } = connection._router._options;

		// Check for errors while executing ending actions
		try {

			// Apply connection session and logger
			await HTTPConnection.applySession(connection, session);
			await HTTPConnection.applyLogger(connection, logger);

			// Call the callback
			callback();
		} catch (error) {
			ErrorEmitter.emit(connection._router, error);
		}
	}

	/**
	 * Prepare connection for writing process
	 * @param {HTTPConnection} connection
	 */
	static start(connection) {

		const { compression, cors, timeout } = connection._router._options;

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