'use strict';

var client = require('simples/lib/client/client'),
	domain = require('domain'),
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
		hosts: {
			value: {}
		},
		port: {
			value: 80,
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
simples.prototype.host = function (name, options) {

	// Select the main host or use another one
	if (typeof name === 'string') {

		// Create a new host if it does not exist
		if (!this.hosts[name]) {
			this.hosts[name] = new host(this, name);
		}

		// Set the host configuration
		if (utils.isObject(options)) {
			this.hosts[name].config(options);
		}
	} else {
		name = 'main';
	}

	return this.hosts[name];
};

// Start simpleS server
simples.prototype.start = function (port, callback) {

	var that = this;

	// Release the server
	function release() {
		that.busy = false;
		utils.runFunction(callback);
		that.emit('release');
	}

	// Set the server to listen the port
	function start() {

		// Set status flags and port
		that.busy = true;
		that.port = port;
		that.started = true;

		// Trigger server release when internal instances are ready
		that.primary.listen(port, function () {
			if (that.secured) {
				that.secondary.listen(80, release);
			} else {
				release();
			}
		});
	}

	// Make parameters optional
	if (typeof port === 'function') {
		callback = port;
	}

	// Get the initial port or check if the port is not reserved
	if (typeof port !== 'number' || port < 1024) {
		if (this.secured) {
			port = 443;
		} else {
			port = 80;
		}
	}

	// If the server is busy wait for release
	if (this.busy) {
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

	// Release the server
	function release() {
		that.busy = false;
		utils.runFunction(callback);
		that.emit('release');
	}

	// Stop the server
	function stop() {

		// Set status flags
		that.busy = true;
		that.started = false;

		// Trigger server release when internal instances are ready
		that.primary.close(function () {
			if (that.secured) {
				that.secondary.close(release);
			} else {
				release();
			}
		});
	}

	// Stop the server only if it is running
	if (this.busy) {
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

	var result = {},
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

	// Make parameters optional
	if (typeof port === 'number') {
		if (typeof options === 'function') {
			callback = options;
		}
	} else if (utils.isObject(port)) {
		if (typeof options === 'function') {
			callback = options;
		}
		options = port;
		port = 443;
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
	}

	// Check for secured server
	if (utils.isObject(options)) {
		server.secured = true;
	}

	// Run vulnerable code inside a domain
	domain.create().on('error', function (error) {

		// Remove server flags
		server.busy = false;
		server.started = false;

		// Emit the error in the context of the server
		server.emit('error', error);
	}).run(function () {

		// Check for secured server
		if (server.secured) {

			// Process options members and prepare the SSL certificates
			Object.keys(options).forEach(function (element) {
				if (/^(?:cert|key|pfx)$/.test(element)) {
					result[element] = fs.readFileSync(options[element]);
				} else {
					result[element] = options[element];
				}
			});

			// Create two internal instances for the HTTPS server
			server.primary = https.Server(result);
			server.secondary = http.Server();

			// Prepare the two internal instances
			server.primary.on('request', onRequest).on('upgrade', onUpgrade);
			server.secondary.on('request', onRequest).on('upgrade', onUpgrade);
		} else {

			// Create only one internal instance for the HTTP server
			server.primary = http.Server();

			// Prepare the internal instance
			server.primary.on('request', onRequest).on('upgrade', onUpgrade);
		}
	});

	return server.start(port, callback);
};

// Create a new client
module.exports.client = function (options) {
	return new client(options);
};

// Create a new session store instance
module.exports.store = function (timeout) {
	return new store(timeout);
};