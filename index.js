'use strict';

var host = require('./lib/http/host'),
	server = require('./lib/http/server');

// SimpleS prototype constructor
var simples = function (port, options, callback) {

	var that = this;

	// Optional cases for port, options and callback
	if (typeof port === 'number') {
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
			value: new server(this, options),
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

	// Start the server when it is ready
	if (this.server.instance) {
		this.start(port, callback);
	} else {
		this.server.on('ready', function () {
			that.start(port, callback);
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
			listen();
		}
	}

	// Optional cases for port and callback
	if (typeof port === 'number') {
		if (this.server.secured) {
			port = 443;
		}
		if (typeof callback !== 'function') {
			callback = null;
		}
	} else if (typeof port === 'function') {
		callback = port;
		if (this.server.secured) {
			port = 443;
		} else {
			port = 80;
		}
	} else {
		port = this.port;
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

	// Check if callback is a function
	if (typeof callback !== 'function') {
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
module.exports = function (port, options, callback) {
	return new simples(port, options, callback);
};