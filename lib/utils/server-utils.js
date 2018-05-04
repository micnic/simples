'use strict';

const ErrorEmitter = require('simples/lib/utils/error-emitter');
const fs = require('fs');
const http = require('http');
const https = require('https');

const certificates = new Set(['cert', 'key', 'pfx']);

const httpDefaultPort = 80; // Default port value for the HTTP protocol
const httpsDefaultPort = 443; // Default port value for the HTTPS protocol

const serverArgTypes = [
	'number',
	'object',
	'function'
];

const serverStartArgTypes = [
	'number',
	'function'
];

const serverEvents = {
	error: 'error',
	release: 'release',
	request: 'request',
	start: 'start',
	stop: 'stop',
	upgrade: 'upgrade'
};

class ServerUtils {

	// Initialize server instances
	static initServer(server, options, callback) {

		// Define server private properties
		server._backlog = options.backlog;
		server._busy = false;
		server._hostname = options.hostname;
		server._instance = null;
		server._port = options.port;
		server._started = false;

		// Prepare the internal instance
		if (options.https) {

			// Set the busy flag to wait for async reading of SSL certificates
			server._busy = true;

			// Prepare the TLS options and apply them to the HTTPS server
			ServerUtils.getTlsOptions(options.https).then((config) => {
				server._busy = false;
				server._instance = https.Server(config);
				ServerUtils.setupServer(server, callback);
			}).catch((error) => {
				ServerUtils.runFunction(callback, server);
				ErrorEmitter.emit(server, error);
			});
		} else {
			server._instance = http.Server();
			ServerUtils.setupServer(server, callback);
		}
	}

	// Read TLS options and extract content of the TLS certificates
	static getTlsOptions(options) {

		const config = {};

		return Promise.all(Object.keys(options).map((key) => {

			return new Promise((resolve, reject) => {
				if (certificates.has(key)) {
					fs.readFile(options[key], (error, content) => {
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
		})).then(() => config);
	}

	// Start listening on specified of the internal server instance
	static listenPort(server, port, callback) {

		// Set the port and the status flags
		server._busy = true;
		server._port = port;
		server._started = true;

		// Start listening by applying the defined arguments
		server._instance.listen(port, server._hostname, server._backlog, () => {
			server._busy = false;
			ServerUtils.runFunction(callback, server);
			server.emit(serverEvents.start, server);
			server.emit(serverEvents.release);
		});
	}

	// Normalize optional arguments
	static normalizeArgs(types, args) {

		return types.reduce((result, type, index) => {

			// Check for different type to insert a default argument
			if (typeof result[index] !== types[index]) {
				result.splice(index, 0, null);
			}

			return result;
		}, Array.from(args));
	}

	// Normalize optional server arguments
	static prepareServerArgs(port, options, callback) {

		// Make arguments optional
		[
			port,
			options,
			callback
		] = ServerUtils.normalizeArgs(serverArgTypes, arguments);

		// Copy options object to prevent mutation of external object
		options = Object.assign({}, options);

		// Overwrite server port in options if present or set default port
		if (typeof port === 'number' && port > 0) {
			options.port = port;
		} else if (typeof options.port === 'number' && options.port > 0) {
			port = options.port;
		} else {

			// Check for HTTPS options to set respective port
			if (options.https) {
				port = httpsDefaultPort;
			} else {
				port = httpDefaultPort;
			}

			// Save the port in the options object
			options.port = port;
		}

		return {
			callback,
			options,
			port
		};
	}

	// Run the function in the provided context with the context as argument
	static runFunction(fn, context) {
		if (typeof fn === 'function') {
			if (context) {
				fn.call(context, context);
			} else {
				fn();
			}
		}
	}

	// Add internal server instance event listeners and start the server
	static setupServer(server, callback) {

		// Start listening to server instance errors
		server._instance.on(serverEvents.error, (error) => {
			server._busy = false;
			server._started = false;
			ErrorEmitter.emit(server, error);
		});

		// Add HTTP and WS request listeners
		server._instance.on(serverEvents.request, server._requestListener);
		server._instance.on(serverEvents.upgrade, server._upgradeListener);

		// Start the server
		ServerUtils.startServer(server, callback);
	}

	// Start or restart the server instance
	static startServer(server, port, callback) {

		// Make arguments optional
		[
			port,
			callback
		] = ServerUtils.normalizeArgs(serverStartArgTypes, arguments);

		// Use server if not provided in the arguments
		if (!port) {
			port = server._port;
		}

		// Check if the server is busy or is already started
		if (server._busy) {
			server.once(serverEvents.release, () => {
				ServerUtils.startServer(server, port, callback);
			});
		} else if (server._started) {
			if (port === server._port) {
				ServerUtils.runFunction(callback, server);
			} else {
				ServerUtils.stopServer(server, () => {
					ServerUtils.listenPort(server, port, callback);
				});
			}
		} else {
			ServerUtils.listenPort(server, port, callback);
		}
	}

	// Stop the server instance
	static stopServer(server, callback) {
		if (server._busy) {
			server.once(serverEvents.release, () => {
				ServerUtils.stopServer(server, callback);
			});
		} else if (server._started) {

			// Set status flags
			server._busy = true;
			server._started = false;

			// Close the internal instance
			server._instance.close(() => {
				server._busy = false;
				ServerUtils.runFunction(callback, server);
				server.emit(serverEvents.stop, server);
				server.emit(serverEvents.release);
			});
		} else {
			ServerUtils.runFunction(callback, server);
		}
	}
}

module.exports = ServerUtils;