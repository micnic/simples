'use strict';

var host = require('simples/lib/http/host'),
	server = require('simples/lib/http/server');

// SimpleS prototype constructor
var simples = function (port, options, callback) {

	// Define special properties for simpleS
	Object.defineProperties(this, {
		hosts: {
			value: {}
		},
		server: {
			value: new server(this, port, options)
		}
	});

	// Call host in this context and set it as the main host
	host.call(this, this);
	this.hosts.main = this;

	// Start the server when it is ready
	if (this.server.instance) {
		this.start(callback);
	} else {
		this.server.on('ready', function () {
			this.parent.start(callback);
		});
	}
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples
	}
});

// Create a new host or return an existing one
simples.prototype.host = function (name, config) {

	// Check for an existing host or create a new host
	if (typeof name === 'string') {
		if (this.hosts[name]) {
			this.hosts[name].config(config);
		} else {
			this.hosts[name] = new host(this, config);
		}
	} else {
		name = 'main';
	}

	return this.hosts[name];
};

// Start simples server
simples.prototype.start = function (port, callback) {

	var server = this.server;

	// Set the server to listen the port
	function listen() {
		server.listen(port, callback);
	}

	// Start or restart the server
	function start() {
		if (server.started) {
			server.close(listen);
		} else {
			listen();
		}
	}

	// Optional cases for port and callback
	if (port && typeof port === 'number') {
		if (server.secured) {
			port = 443;
		}
		if (typeof callback !== 'function') {
			callback = null;
		}
	} else if (typeof port === 'function') {
		callback = port;
		if (server.secured) {
			port = 443;
		} else {
			port = server.port;
		}
	} else {
		port = server.port;
		callback = null;
	}

	// If the server is busy wait for release
	if (server.busy) {
		server.once('release', start);
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

		// Clear all existing hosts
		Object.keys(that.hosts).forEach(function (host) {
			that.hosts[host].close();
		});

		// Close the server
		that.server.close(callback);
	}

	// Check if callback is a function
	if (typeof callback !== 'function') {
		callback = null;
	}

	// Stop the server only if it is running
	if (this.server.started) {
		if (this.server.busy) {
			this.server.once('release', stop);
		} else {
			stop();
		}
	}

	return this;
};

// Export a new simpleS instance
module.exports = function (port, options, callback) {

	// Optional cases for port, options and callback
	if (port && typeof port === 'number') {
		if (typeof options === 'object' && typeof callback === 'function') {
			port = 443;
		} else if (typeof options === 'object') {
			port = 443;
			callback = null;
		} else if (typeof options === 'function') {
			callback = options;
			options = null;
		} else {
			options = null;
			callback = null;
		}
	} else if (typeof port === 'object') {
		if (typeof options === 'function') {
			callback = options;
		} else {
			callback = null;
		}
		options = port;
		port = 443;
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
		options = null;
	} else {
		port = 80;
		options = null;
		callback = null;
	}

	return new simples(port, options, callback);
};