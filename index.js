'use strict';

var domain = require('domain'),
	fs = require('fs'),
	host = require('simples/lib/http/host'),
	http = require('http'),
	https = require('https'),
	store = require('simples/lib/store'),
	utils = require('simples/utils/utils');

// SimpleS prototype constructor
var simples = function () {

	// Call host in this context and name it as main
	host.call(this, this, 'main');

	// Define private properties for simpleS
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		domain: {
			value: domain.create()
		},
		hosts: {
			value: {}
		},
		port: {
			value: 80,
			writable: true
		},
		ready: {
			value: false,
			writable: true
		},
		secured: {
			value: false,
			writable: true
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Set current instance as the main host
	this.hosts.main = this;
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples
	}
});

// Create a new host or return an existing one
simples.prototype.host = function (name, config) {

	// Select the main host or use another one
	if (typeof name === 'string') {

		// Create a new host if it does not exist
		if (!this.hosts[name]) {
			this.hosts[name] = new host(this, name);
		}

		// Set the host configuration
		if (utils.isObject(config)) {
			this.hosts[name].config(config);
		}
	} else {
		name = 'main';
	}

	return this.hosts[name];
};

// Start simpleS server
simples.prototype.start = function (port, callback) {

	var that = this;

	// Set the server to listen the port
	function start() {

		// Set status flags and port
		that.busy = true;
		that.port = port;
		that.started = true;

		// Trigger server release when internal instances are ready
		that.primary.listen(port, function () {
			if (that.secured) {
				that.secondary.listen(80, function () {
					that.busy = false;
					utils.runFunction(callback);
					that.emit('release');
				});
			} else {
				that.busy = false;
				utils.runFunction(callback);
				that.emit('release');
			}
		});
	}

	// Optional cases for port and callback
	if (typeof port === 'function') {
		callback = port;
		port = this.port;
	} else if (this.secured) {
		port = 443;
	} else if (typeof port !== 'number') {
		port = this.port;
	}

	// If the server is busy wait for release
	if (this.busy || !this.ready) {
		this.once('release', function () {
			that.start(port, callback);
		});
	} else if (this.started) {
		this.stop(start);
	} else {
		start();
	}

	return this;
};

// Stop simpleS server
simples.prototype.stop = function (callback) {

	var that = this;

	// Stop the server
	function stop() {

		// Set status flags
		that.busy = true;
		that.started = false;

		// Trigger server release when internal instances are ready
		that.primary.close(function () {
			if (that.secured) {
				that.secondary.close(function () {
					that.busy = false;
					utils.runFunction(callback);
					that.emit('release');
				});
			} else {
				that.busy = false;
				utils.runFunction(callback);
				that.emit('release');
			}
		});
	}

	// Stop the server only if it is running
	if (this.busy || !this.ready) {
		this.once('release', function () {
			that.stop(callback);
		});
	} else if (this.started) {
		stop();
	} else {
		utils.runFunction(callback);
	}

	return this;
};

// Export a new simpleS instance
module.exports = function (port, options, callback) {

	var files = 0,
		result = {},
		server = new simples();

	// Listener for HTTP requests
	function onRequest(request, response) {

		var host = utils.http.getHost(server, request);

		// Process the received request
		utils.http.connectionListener(host, request, response);
	}

	// Listener for WebSocket requests
	function onUpgrade(request, socket) {

		var host = utils.ws.getHost(server, request);

		// Check for a defined WebSocket host
		if (host) {
			utils.ws.connectionListener(host, request);
		} else {
			socket.destroy();
		}
	}

	// Prepare an internal server instance
	function prepareInstance(instance) {

		// Add the internal instance to the server domain to catch errors
		server.domain.add(instance);

		// Set the request listeners for the internal instance
		instance.on('request', onRequest).on('upgrade', onUpgrade);
	}

	// Optional cases for port, options and callback
	if (typeof port === 'number') {
		if (typeof options === 'function') {
			callback = options;
		}
	} else if (utils.isObject(port)) {
		if (typeof options === 'function') {
			callback = options;
		}
		options = port;
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
	} else {
		port = 80;
	}

	// Check for secured server
	if (utils.isObject(options)) {
		server.secured = true;
	} else {
		options = {};
	}

	// Process options members and prepare the SSL certificates
	Object.keys(options).filter(function (element) {

		// Copy options members
		result[element] = options[element];

		return /^(?:cert|key|pfx)$/.test(element);
	}).forEach(function (element) {

		// Increase the number of files to read
		files++;

		// Read the current file
		fs.readFile(options[element], function (error, content) {
			if (error) {
				server.emit('error', new Error('Can not read SSL certificate'));
			} else {

				// Decrease the number of files to read
				files--;

				// Add the content of the file to the result
				result[element] = content;

				// Check if all files are read
				if (files === 0) {

					// Release the server
					server.emit('release');
				}
			}
		});
	});

	// Emit the errors from the internal instances
	server.domain.on('error', function (error) {

		// Remove server flags
		server.busy = false;
		server.started = false;

		// Emit the error further or just throw it
		if (server.listeners('error').length) {
			server.emit('error', error);
		} else {
			throw error;
		}
	});

	// Check for secured server
	if (server.secured) {
		server.once('release', function () {

			// Create two internal instances for the HTTPS server
			server.primary = https.Server(result);
			server.secondary = http.Server();

			// Prepare the two internal instances
			prepareInstance(server.primary);
			prepareInstance(server.secondary);

			// Set ready flag for the server
			server.ready = true;
		});
	} else {

		// Create only one internal instance for the HTTP server
		server.primary = http.Server();

		// Prepare the internal instance
		prepareInstance(server.primary);

		// Set ready flag for the server
		server.ready = true;
	}

	return server.start(port, callback);
};

// Create a new session store instance
exports.store = function (timeout) {
	return new store(timeout);
};