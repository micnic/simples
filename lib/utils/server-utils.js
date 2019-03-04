'use strict';

const Args = require('simples/lib/utils/args');
const Config = require('simples/lib/utils/config');
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

// TODO: move to WeakMap when WeakMaps will be faster
const serverMeta = new Map();

class ServerUtils {

	static getServerMeta(server) {

		return serverMeta.get(server);
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

	// Initialize server instances
	static initServer(server, callback) {

		const meta = ServerUtils.getServerMeta(server);

		// Prepare the internal instance
		if (meta.https) {

			// Set the busy flag to wait for async reading of SSL certificates
			meta.busy = true;

			// Prepare the TLS options and apply them to the HTTPS server
			ServerUtils.getTlsOptions(meta.https).then((config) => {
				meta.busy = false;
				meta.instance = https.Server(config);
				ServerUtils.setupServer(server, callback);
			}).catch((error) => {
				ServerUtils.runFunction(callback, server);
				ErrorEmitter.emit(server, error);
			});
		} else {
			meta.instance = http.Server();
			ServerUtils.setupServer(server, callback);
		}

		return server;
	}

	// Start listening on specified of the internal server instance
	static listenPort(server, port, callback) {

		const meta = ServerUtils.getServerMeta(server);

		// Set the port and the status flags
		meta.busy = true;
		meta.port = port;
		meta.started = true;

		// Start listening by applying the defined arguments
		meta.instance.listen(port, meta.hostname, meta.backlog, () => {
			meta.busy = false;
			ServerUtils.runFunction(callback, server);
			server.emit(serverEvents.start, server);
			server.emit(serverEvents.release);
		});
	}

	// Normalize optional server arguments
	static prepareServerArgs(port, options, callback) {

		// Make arguments optional
		[
			port,
			options,
			callback
		] = Args.getArgs(serverArgTypes, port, options, callback);

		// Copy options object to prevent mutation of external object
		options = Object.assign({}, options);

		// Overwrite server port in options if present or set default port
		if (typeof port === 'number') {
			options.port = port;
		} else if (typeof options.port !== 'number') {

			// Check for HTTPS options to set respective port
			if (options.https) {
				options.port = httpsDefaultPort;
			} else {
				options.port = httpDefaultPort;
			}
		}

		return {
			callback,
			options
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

	static setServerMeta(server, options, listeners) {
		serverMeta.set(server, Object.assign({
			busy: false,
			instance: null,
			started: false
		}, Config.getConfig({
			backlog: {
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
		}, options), listeners));
	}

	// Add internal server instance event listeners and start the server
	static setupServer(server, callback) {

		const meta = ServerUtils.getServerMeta(server);

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
		ServerUtils.startServer(server, callback);
	}

	// Start or restart the server instance
	static startServer(server, port, callback) {

		const meta = ServerUtils.getServerMeta(server);

		// Make arguments optional
		[
			port,
			callback
		] = Args.getArgs(serverStartArgTypes, port, callback);

		// Use server if not provided in the arguments
		if (!port || port <= 0) {
			port = meta.port;
		}

		// Check if the server is busy or is already started
		if (meta.busy) {
			server.once(serverEvents.release, () => {
				ServerUtils.startServer(server, port, callback);
			});
		} else if (meta.started) {
			if (port === meta.port) {
				ServerUtils.runFunction(callback, server);
			} else {
				ServerUtils.stopServer(server, () => {
					ServerUtils.listenPort(server, port, callback);
				});
			}
		} else {
			ServerUtils.listenPort(server, port, callback);
		}

		return server;
	}

	// Stop the server instance
	static stopServer(server, callback) {

		const meta = ServerUtils.getServerMeta(server);

		if (meta.busy) {
			server.once(serverEvents.release, () => {
				ServerUtils.stopServer(server, callback);
			});
		} else if (meta.started) {

			// Set status flags
			meta.busy = true;
			meta.started = false;

			// Close the internal instance
			meta.instance.close(() => {
				meta.busy = false;
				ServerUtils.runFunction(callback, server);
				server.emit(serverEvents.stop, server);
				server.emit(serverEvents.release);
			});
		} else {
			ServerUtils.runFunction(callback, server);
		}

		return server;
	}
}

module.exports = ServerUtils;