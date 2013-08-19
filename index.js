'use strict';

var fs = require('fs'),
	host = require('./lib/http/host'),
	httpUtils = require('./lib/http'),
	utils = require('./utils/utils');

// SimpleS prototype constructor
var simples = function (port, options) {

	var that = this;

	// Set the port to be optional
	if (typeof port !== 'number') {
		if (port && typeof port === 'object') {
			options = port;
		} else {
			port = 80;
		}
	}

	// Always listen on port 443 for HTTPS
	if (options) {
		port = 443;
	}

	// Define special properties for simpleS
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		hosts: {
			value: {}
		},
		port: {
			value: port,
			writable: true
		},
		server: {
			value: null,
			writable: true
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Call host in this context and set it as the main host
	host.call(this, this, 'main');

	// Server error listener
	function onServerError(error) {
		that.busy = false;
		that.started = false;
		throw new Error('simpleS: Server error > ' + error.message);
	}

	// Server release listener
	function onServerRelease(callback) {
		that.busy = false;

		// Call the callback when the server is free
		if (callback) {
			callback.call(that);
		}
	}

	// Create the server
	httpUtils.httpCreateServer(options, function (server) {

		// Bind the server to the simpleS instance
		that.server = server;
		server.parent = that;

		// Listen for server events
		server.on('error', onServerError).on('release', onServerRelease);

		// Start the server on the provided port
		that.start();
	});
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples
	}
});

// Create a new host
simples.prototype.host = function (name) {

	var result;

	// Check if the host name is defined and is a string
	if (typeof name !== 'string') {
		console.error('\nsimpleS: The name of the host must be a string\n');
		result = this.hosts.main;
	} else {
		result = new host(this, name);
	}

	return result;
};

// Start simples server
simples.prototype.start = function (port, callback) {

	var that = this;

	// Set the server to listen the port
	function listen() {

		// Start all existing hosts
		Object.keys(that.hosts).forEach(function (host) {
			that.hosts[host].open();
		});

		// Start listening the port
		that.server.listen(port, function () {
			that.server.emit('release', callback);
			that.server.emit('open');
		});
	}

	// Start or restart the server
	function start() {

		// Set the busy flag
		that.busy = true;

		// Check if server is started
		if (that.started) {
			that.server.close(listen);
		} else {
			that.started = true;
			utils.getSessions(that, listen);
		}
	}

	// Set the port to be optional
	if (typeof port !== 'number') {
		if (typeof port === 'function') {
			callback = port;
		}
		port = this.port;
	}

	// Check if callback is defined and is a function
	if (callback && typeof callback !== 'function') {
		console.error('\nsimpleS: The callback parameter is not a function\n');
		callback = null;
	}

	// If the server is busy wait for release
	if (this.busy) {
		this.server.once('release', start);
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

		// Close all existing hosts
		Object.keys(that.hosts).forEach(function (host) {
			that.hosts[host].close();
		});

		// Close the server
		that.server.close(function () {
			utils.saveSessions(that, callback);
		});
	}

	// Check if callback is defined and is a function
	if (callback && typeof callback !== 'function') {
		console.error('\nsimpleS: The callback parameter is not a function\n');
		callback = null;
	}

	// Stop the server only if it is running
	if (this.busy && this.started) {
		this.server.once('release', stop);
	} else if (this.started) {
		stop();
	}

	return this;
};

// Export a new simpleS instance
module.exports = function (port, options) {
	return new simples(port, options);
};