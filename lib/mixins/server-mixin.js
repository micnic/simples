'use strict';

var fs = require('fs'),
	http = require('http'),
	https = require('https'),
	utils = require('simples/utils/utils');

// Server mixin prototype constructor
var ServerMixin = function (options, callback) {

	var config = {},
		files = 0,
		that = this;

	// Define the private properties for the server mixin
	Object.defineProperties(this, {
		backlog: {
			value: options.backlog
		},
		busy: {
			value: false,
			writable: true
		},
		hostname: {
			value: options.hostname
		},
		instance: {
			value: null,
			writable: true
		},
		port: {
			value: options.port,
			writable: true
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Prepare the internal instance
	if (options.https) {

		// Set the busy flag to wait for async reading of SSL certificates
		this.busy = true;

		// Prepare TLS configuration
		Object.keys(options.https).forEach(function (option) {
			if (/^(?:cert|key|pfx)$/.test(option)) {

				// Increase the amount of files to read
				files++;

				// Get asynchronously the content of the SSL certificates
				fs.readFile(options.https[option], function (error, content) {
					if (error) {
						that.emit('error', error);
					} else {

						// Add the content to the server configuration object
						config[option] = content;

						// Decrease the amount of files to read
						files--;

						// Check if there are more files to read
						if (!files) {
							that.busy = false;
							that.instance = https.Server(config);
							ServerMixin.setupServer(that, callback);
						}
					}
				});
			} else {
				config[option] = options.https[option];
			}
		});
	} else {
		this.instance = http.Server();
		ServerMixin.setupServer(this, callback);
	}
};

// Start listening on specified of the internal server instance
ServerMixin.listenPort = function (server, port, callback) {

	var args = [],
		instance = server.instance;

	// Set the port and the status flags
	server.busy = true;
	server.port = port;
	server.started = true;

	// Add the port to the arguments
	args.push(port);

	// If there is a hostname defined add it to the arguments
	if (server.hostname) {
		args.push(server.hostname);
	}

	// If there is a backlog defined add it to the arguments
	if (server.backlog) {
		args.push(server.backlog);
	}

	// Add the callback to listen the server start
	args.push(function () {
		server.busy = false;
		utils.runFunction(callback, server);
		server.emit('start', server);
		server.emit('release');
	});

	// Start listening by applying the defined arguments
	instance.listen.apply(instance, args);
};

ServerMixin.normalizeArguments = function (port, options, callback) {

	// Make parameters optional
	if (typeof port === 'number') {
		if (typeof options === 'object') {
			options = utils.assign({}, options, {
				port: port
			});

			if (typeof callback !== 'function') {
				callback = null;
			}
		} else if (typeof options === 'function') {
			callback = options;
			options = {
				port: port
			};
		} else {
			options = {
				port: port
			};
			callback = null;
		}
	} else if (typeof port === 'object') {

		// Make options argument optional
		if (typeof options === 'function') {
			callback = options;
		} else {
			callback = null;
		}

		// Get the options value from the port argument
		options = port;

		// Check for null value to create an empty options object
		if (!options) {
			options = {};
		}

		// Set default port for HTTP and HTTPS if no port was defined
		if (options.https) {
			port = 443;
		} else {
			port = 80;
		}

		// Prepare the options object
		options = utils.assign({}, options, {
			port: port
		});
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
		options = {
			port: port
		};
	} else {
		port = 80;
		options = {
			port: port
		};
		callback = null;
	}

	return {
		options: options,
		port: port,
		callback: callback
	};
};

// Add internal server instance event listeners and start the server
ServerMixin.setupServer = function (server, callback) {
	/* istanbul ignore next: take this error delegation as an axiom */
	server.instance.on('error', function (error) {
		server.busy = false;
		server.started = false;
		server.emit('error', error);
	});
	server.instance.on('request', server.requestListener);
	server.instance.on('upgrade', server.upgradeListener);
	server.start(callback);
};

// Start or restart the server instance
ServerMixin.startServer = function (server, port, callback) {

	// Make parameters optional
	if (typeof port === 'function') {
		callback = port;
		port = server.port;
	} else if (typeof port !== 'number') {
		port = server.port;
		callback = null;
	}

	// Check if the server is busy or is already started
	if (server.busy) {
		server.once('release', function () {
			server.start(port, callback);
		});
	} else if (server.started && port !== server.port) {
		server.stop(function () {
			ServerMixin.listenPort(server, port, callback);
		});
	} else {
		ServerMixin.listenPort(server, port, callback);
	}
};

// Stop the server instance
ServerMixin.stopServer = function (server, callback) {
	if (server.busy) {
		server.once('release', function () {
			server.stop(callback);
		});
	} else if (server.started) {

		// Set status flags
		server.busy = true;
		server.started = false;

		// Close the internal instance
		server.instance.close(function () {
			server.busy = false;
			utils.runFunction(callback, server);
			server.emit('stop', server);
			server.emit('release');
		});
	} else {
		utils.runFunction(callback, server);
	}
};

module.exports = ServerMixin;