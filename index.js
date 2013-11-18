'use strict';

var host = require('./lib/http/host'),
	utils = require('./utils/utils');

// SimpleS prototype constructor
var simples = function (port, options) {

	var that = this;

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
			value: 80,
			writable: true
		},
		secured: {
			value: false,
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
	this.hosts.main = this;

	// Create and configure the server
	utils.http.createServer(options, function (server, secured) {
		server.parent = that;
		that.secured = secured;
		that.server = server;
		that.start(port);
	});
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples
	}
});

// Create a new host or return an existing one
simples.prototype.host = function (name, config) {

	// Check if the host name is a string and create a new host
	if (typeof name === 'string' && name !== 'main' && !this.hosts[name]) {
		this.hosts[name] = new host(this, name, config);
	} else if (this.hosts[name]) {
		this.hosts[name].config(config);
	}

	return this.hosts[name] || this.hosts.main;
};

// Start simples server
simples.prototype.start = function (port, callback) {

	var that = this;

	// Set the server to listen the port
	function listen() {

		// Set the started flag
		that.started = true;

		// Listen on the port
		that.server.listen(port, function () {
			that.port = port;
			that.server.emit('release', callback);
			that.server.emit('open');
		});
	}

	// Start or restart the server
	function start() {

		// Set the port to be optional
		if (typeof port !== 'number') {
			port = that.port;
		}

		// Always use port 443 for HTTPS
		if (that.secured) {
			port = 443;
		}

		// Set the busy flag
		that.busy = true;

		// Check if server is started
		if (that.started) {
			that.server.close(listen);
		} else {
			listen();
		}
	}

	// Check if callback is defined and is a function
	if (callback && typeof callback !== 'function') {
		callback = null;
	}

	// Get callback as the only parameter
	if (typeof port === 'function') {
		callback = port;
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

	// Close all the open connections to the WS host
	function clearWsHost(wsHost) {
		wsHost.connections.forEach(function (connection) {
			connection.close();
		});
	}

	// Stop the timers of the sessions and the child WS hosts of the host
	function clearHttpHost(host) {

		// Clear the timers
		Object.keys(host.timers).forEach(function (timer) {
			clearTimeout(host.timers[timer]);
		});

		// Clear the WS hosts
		Object.keys(host.wsHosts).forEach(function (wsHost) {
			clearWsHost(host.wsHosts[wsHost]);
		});
	}

	// Stop the server
	function stop() {

		// Set status flags
		that.busy = true;
		that.started = false;

		// Clear all existing hosts
		Object.keys(that.hosts).forEach(function (host) {
			clearHttpHost(that.hosts[host]);
		});

		// Close the server
		that.server.close(function () {
			that.server.emit('release', callback);
		});
	}

	// Check if callback is defined and is a function
	if (callback && typeof callback !== 'function') {
		callback = null;
	}

	// Stop the server only if it is running
	if (this.started) {
		if (this.busy) {
			this.server.once('release', stop);
		} else {
			stop();
		}
	}

	return this;
};

// Export a new simpleS instance
module.exports = function (port, options) {
	return new simples(port, options);
};