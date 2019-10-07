'use strict';

const { readFile } = require('fs');
const http = require('http');
const https = require('https');
const Config = require('simples/lib/utils/config');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const { httpRequestListener } = require('simples/lib/utils/http-utils');
const { badRequest, wsRequestListener } = require('simples/lib/utils/ws-utils');
const { URL } = require('url');

const { assign, keys } = Object;

const httpDefaultPort = 80; // Default port value for the HTTP protocol
const httpsDefaultPort = 443; // Default port value for the HTTPS protocol

const colon = ':'; // Colon for separation of port in HTTP host name
const httpProtocol = 'http'; // HTTP protocol name
const leftSquareBracket = '['; // Left square bracket for URL IPv6 literal
const protocolSeparator = '://'; // Separator between protocol and host name
const rightSquareBracket = ']'; // Right square bracket for URL IPv6 literal
const securedProtocolSuffix = 's'; // Suffix for secured protocols
const wsProtocol = 'ws'; // WS protocol name

const certificates = new Set(['cert', 'key', 'pfx']);

// Regular expression for dynamic HTTP host name
const dynamicHTTPHostNameRex = /\*/;

const serverEvents = {
	error: 'error',
	release: 'release',
	request: 'request',
	start: 'start',
	stop: 'stop',
	upgrade: 'upgrade'
};

/**
 * Get an HTTP or a WS host if it exists
 * @param {MapContainer} hosts
 * @param {string} name
 * @param {HTTPHost|WSHost} main
 */
const getHost = (hosts, name, main) => {

	const { dynamic, fixed } = hosts;

	// Check in fixed hosts
	if (fixed.has(name)) {
		return fixed.get(name);
	}

	// Search in the dynamic hosts
	if (dynamic.size > 0) {
		for (const host of dynamic.values()) {
			if (host._pattern.test(name)) {
				return host;
			}
		}
	}

	return main;
};

/**
 * Strip port value from the host header to get the host name
 * @param {string} header
 * @returns {string}
 */
const getHTTPHostName = (header) => {

	let index = 0;

	// Check for IPv6 literal
	if (header[0] === leftSquareBracket) {
		index = header.indexOf(rightSquareBracket) + 1;
	}

	// Find port value
	index = header.indexOf(colon, index);

	// Check for found port to ignore it in output
	if (index >= 0) {
		return header.substring(0, index);
	}

	return header;
};

/**
 * Get an existent HTTP host or the main HTTP host
 * @param {Server} server
 * @param {IncomingMessage} request
 * @returns {HTTPHost}
 */
const getHTTPHost = (server, request) => {

	const header = request.headers.host;
	const hosts = server._hosts;

	// Check for HTTP hosts count and HTTP host header
	if ((hosts.fixed.size > 0 || hosts.dynamic.size > 0) && header) {

		return getHost(hosts, getHTTPHostName(header), server);
	}

	return server;
};

/**
 * Get parsed request url
 * @param {IncomingMessage} request
 * @param {string} protocol
 * @returns {URL}
 */
const getRequestLocation = (request, protocol) => {

	let address = protocol;

	// Check for secured protocol to add the secured protocol suffix
	if (request.socket.encrypted) {
		address += securedProtocolSuffix;
	}

	// Add protocol separator after the protocol
	address += protocolSeparator;

	// Check if the host header is present
	if (request.headers.host) {
		address += request.headers.host;
	} else {
		address += request.socket.localAddress;
	}

	// Append request url to the address
	address += request.url;

	return new URL(address);
};

/**
 * Prepare server meta
 * @param {*} options
 * @param {*} listeners
 * @param {*}
 */
const getServerMeta = (options, listeners) => {
	// TODO: use object spread in Node 10+
	return assign({
		busy: false,
		instance: null,
		started: false
	}, Config.getConfig({
		backlog: {
			default: null,
			type: Config.types.number
		},
		hostname: {
			type: Config.types.string
		},
		https: {
			type: Config.types.object
		},
		port: {
			type: Config.types.number
		}
	}, options), listeners);
};

/**
 * Read TLS options and extract content of the TLS certificates
 * @param {*} options
 * @returns {Promise<*>}
 */
const getTLSOptions = async (options) => {

	const config = {};

	await Promise.all(keys(options).map((key) => {

		return new Promise((resolve, reject) => {
			if (certificates.has(key)) {
				readFile(options[key], (error, content) => {
					if (error) {
						reject(error);
					} else {
						config[key] = content;
						resolve();
					}
				});
			} else {
				config[key] = options[key];
				resolve();
			}
		});
	}));

	return config;
};

/**
 * Get an existing WS host
 * @param {Server} server
 * @param {string} pathname
 * @param {IncomingMessage} request
 * @returns {WSHost}
 */
const getWSHost = (server, pathname, request) => {

	const {
		_routes: {
			ws: hosts
		}
	} = getHTTPHost(server, request);

	return getHost(hosts, pathname, null);
};

/**
 * Check if HTTP host name is dynamic
 * @param {string} name
 * @returns {boolean}
 */
const isHTTPHostNameDynamic = (name) => {

	return dynamicHTTPHostNameRex.test(name);
};

/**
 * Run the function in the provided context with the context as argument
 * @param {(context: *) => void} fn
 * @param {*} context
 */
const runFunction = (fn, context) => {
	if (typeof fn === 'function') {
		fn.call(context, context);
	}
};

/**
 * Start listening on specified of the internal server instance
 * @param {Server|Mirror} server
 * @param {number} port
 * @param {Callback<Server|Mirror>} callback
 */
const listenPort = (server, port, callback) => {

	const meta = server._meta;

	// Set the port and the status flags
	meta.busy = true;
	meta.port = port;
	meta.started = true;

	// Start listening by applying the defined arguments
	meta.instance.listen(port, meta.hostname, meta.backlog, () => {
		meta.busy = false;
		runFunction(callback, server);
		server.emit(serverEvents.start, server);
		server.emit(serverEvents.release);
	});
};

/**
 * Stop the server instance
 * @param {Server|Mirror} server
 * @param {Callback<Server|Mirror>} callback
 * @returns {Server|Mirror}
 */
const stopServer = (server, callback) => {

	const meta = server._meta;

	if (meta.busy) {
		server.once(serverEvents.release, () => {
			stopServer(server, callback);
		});
	} else if (meta.started) {

		// Set status flags
		meta.busy = true;
		meta.started = false;

		// Close the internal instance
		meta.instance.close(() => {
			meta.busy = false;
			runFunction(callback, server);
			server.emit(serverEvents.stop, server);
			server.emit(serverEvents.release);
		});
	} else {
		runFunction(callback, server);
	}

	return server;
};

/**
 * Start or restart the server instance
 * @param {Server|Mirror} server
 * @param {number} port
 * @param {Callback<Server|Mirror>} callback
 * @returns {Server|Mirror}
 */
const startServer = (server, port, callback) => {

	const meta = server._meta;
	const args = {
		callback: null,
		port: meta.port
	};

	// Check for optional arguments
	if (typeof port === 'number') {
		args.port = port;

		// Set callback if provided
		if (typeof callback === 'function') {
			args.callback = callback;
		}
	} else if (typeof port === 'function') {
		args.callback = port;
	}

	// Check if the server is busy or is already started
	if (meta.busy) {
		server.once(serverEvents.release, () => {
			startServer(server, args.port, args.callback);
		});
	} else if (meta.started) {
		if (args.port === meta.port) {
			runFunction(args.callback, server);
		} else {
			stopServer(server, () => {
				listenPort(server, args.port, args.callback);
			});
		}
	} else {
		listenPort(server, args.port, args.callback);
	}

	return server;
};

/**
 * Add internal server instance event listeners and start the server
 * @param {Server|Mirror} server
 * @param {Callback<Server|Mirror>} callback
 */
const setupServer = (server, callback) => {

	const meta = server._meta;

	// Start listening to server instance errors
	meta.instance.on(serverEvents.error, (error) => {
		meta.busy = false;
		meta.started = false;
		ErrorEmitter.emit(server, error);
	});

	// Add HTTP and WS request listeners
	meta.instance.on(serverEvents.request, meta.requestListener);
	meta.instance.on(serverEvents.upgrade, meta.upgradeListener);

	// Start the server
	startServer(server, callback);
};

/**
 * Initialize server instances
 * @param {Server|Mirror} server
 * @param {Callback<Server|Mirror>} callback
 */
const initServer = async (server, callback) => {

	const meta = server._meta;

	// Prepare the internal instance
	if (meta.https) {

		// Set the busy flag to wait for async reading of SSL certificates
		meta.busy = true;

		// Check for errors while getting TLS options
		try {
			meta.instance = https.Server(await getTLSOptions(meta.https));
			meta.busy = false;
			setupServer(server, callback);
		} catch (error) {
			runFunction(callback, server);
			ErrorEmitter.emit(server, error);
		}
	} else {
		meta.instance = http.Server();
		setupServer(server, callback);
	}
};

/**
 * Normalize optional server arguments
 * @param {number} port
 * @param {ServerOptions} options
 * @param {Callback<Server|Mirror>} callback
 * @returns {{ callback: Callback<Server|Mirror>, options: ServerOptions }}
 */
const prepareServerArgs = (port, options, callback) => {

	const args = {
		callback: null,
		options: {}
	};

	// Check for optional arguments
	if (typeof port === 'number') {

		// Check for provided options
		if (typeof options === 'object') {

			// Assign options
			assign(args.options, options);

			// Set callback if provided
			if (typeof callback === 'function') {
				args.callback = callback;
			}
		} else if (typeof options === 'function') {
			args.callback = options;
		}

		// Overwrite port value in the provided options
		args.options.port = port;
	} else {

		// Check for optional port case
		if (typeof port === 'object') {

			// Assign options
			assign(args.options, port);

			// Set callback if provided
			if (typeof options === 'function') {
				args.callback = options;
			}
		} else if (typeof port === 'function') {
			args.callback = port;
		}

		// Check for port in options to set default port
		if (typeof args.options.port !== 'number') {
			if (args.options.https) {
				args.options.port = httpsDefaultPort;
			} else {
				args.options.port = httpDefaultPort;
			}
		}
	}

	return args;
};

/**
 * Return a listener for HTTP requests
 * @param {Server} server
 * @returns {RequestListener}
 */
const requestListener = (server) => {

	return (request, response) => {

		// Process the received request
		httpRequestListener(
			getHTTPHost(server, request),
			getRequestLocation(request, httpProtocol),
			request,
			response
		);
	};
};

/**
 * Return a listener for WS requests
 * @param {Server} server
 * @returns {UpgradeListener}
 */
const upgradeListener = (server) => {

	return (request, socket) => {

		const location = getRequestLocation(request, wsProtocol);
		const host = getWSHost(server, location.pathname, request);

		// Check for a defined WebSocket host and process received request
		if (host) {
			wsRequestListener(host, location, request);
		} else {
			badRequest(socket);
		}
	};
};

module.exports = {
	getHTTPHost,
	getHTTPHostName,
	getHost,
	getRequestLocation,
	getServerMeta,
	getTLSOptions,
	getWSHost,
	initServer,
	isHTTPHostNameDynamic,
	listenPort,
	prepareServerArgs,
	requestListener,
	runFunction,
	setupServer,
	startServer,
	stopServer,
	upgradeListener
};