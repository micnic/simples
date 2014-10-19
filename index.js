'use strict';

var host = require('simples/lib/http/host'),
	http = require('http'),
	https = require('https'),
	store = require('simples/lib/store'),
	url = require('url'),
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
	function listen() {

		// Set status flags and port
		that.busy = true;
		that.port = port;
		that.started = true;

		// Emit open event if secondary server exists
		if (that.secondary) {
			that.instance.emit('open');
		}

		// On server instance port listening emit release event
		that.instance.listen(port, function () {
			this.emit('release', callback);
		});
	}

	// Start or restart the server
	function start() {
		if (that.started) {
			that.stop(listen);
		} else {
			listen();
		}
	}

	// Optional cases for port and callback
	if (typeof port === 'number') {
		if (typeof callback !== 'function') {
			callback = null;
		}
	} else if (typeof port === 'function') {
		callback = port;
		port = this.port;
	} else {
		callback = null;
		port = this.port;
	}

	// Always set port 443 for HTTPS
	if (this.secured) {
		port = 443;
	}

	// If the server is busy wait for release
	if (this.busy) {
		this.instance.once('release', start);
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

		// On server instance close emit release event
		that.instance.close(function () {
			this.emit('release', callback);
		});
	}

	// Check if callback is a function
	if (typeof callback !== 'function') {
		callback = null;
	}

	// Stop the server only if it is running
	if (this.started) {
		if (this.busy) {
			this.instance.once('release', stop);
		} else {
			stop();
		}
	}

	return this;
};

// Export a new simpleS instance
module.exports = function (port, options, callback) {

	var server = new simples();

	// Optional cases for port, options and callback
	if (typeof port === 'number') {
		if (utils.isObject(options) && typeof callback === 'function') {
			port = 443;
		} else if (utils.isObject(options)) {
			port = 443;
			callback = null;
		} else if (typeof options === 'function') {
			callback = options;
			options = null;
		} else {
			options = null;
			callback = null;
		}
	} else if (utils.isObject(port)) {
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

	// Create the internal server instance
	if (utils.isObject(options)) {
		utils.prepareSecuredServer(server, options, function (result) {
			server.secured = true;
			server.instance = https.Server(result);
			server.secondary = http.Server();
			utils.prepareServer(server, port, callback);
		});
	} else {
		server.instance = http.Server();
		utils.prepareServer(server, port, callback);
	}

	return server;
};

// Create a new session store instance
exports.store = function (timeout) {
	return new store(timeout);
};