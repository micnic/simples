'use strict';

var Host = require('simples/lib/http/host'),
	Mirror = require('simples/lib/mirror'),
	utils = require('simples/utils/utils');

// Server prototype constructor
var Server = function (port, options) {

	var hosts = {},
		that = this;

	// Process HTTP requests
	function requestListener(request, response) {

		var host = utils.http.getHost(that, request);

		// Process the received request
		utils.http.connectionListener(host, request, response);
	}

	// Process WS requests
	function upgradeListener(request, socket) {

		var host = utils.ws.getHost(that, request);

		// Check for a defined WebSocket host
		if (host) {
			utils.ws.connectionListener(host, request);
		} else {
			socket.destroy();
		}
	}

	// Call host in this context and name it as main
	Host.call(this, this, 'main');

	// Overwrite the port with the value from the options object
	if (typeof options.port === 'number') {
		port = options.port;
	}

	// Define the private properties for the server
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
		hosts: {
			value: hosts
		},
		instance: {
			value: utils.createInstance(this, options)
		},
		mirrors: {
			value: {}
		},
		port: {
			value: port,
			writable: true
		},
		started: {
			value: false,
			writable: true
		},
		requestListener: {
			value: requestListener
		},
		upgradeListener: {
			value: upgradeListener
		}
	});

	// Add the server listeners
	this.instance.on('request', requestListener);
	this.instance.on('upgrade', upgradeListener);

	// Set the server as the main host
	hosts.main = this;
};

// Inherit from host
Server.prototype = Object.create(Host.prototype, {
	constructor: {
		value: Server
	}
});

// Create a new host or return an existing one
Server.prototype.host = function (name, options) {

	// Select the main host or use another one
	if (typeof name === 'string') {

		// Create a new host if it does not exist
		if (!this.hosts[name]) {
			this.hosts[name] = new Host(this, name);
		}

		// Set the host configuration
		if (options && typeof options === 'object') {
			this.hosts[name].config(options);
		}
	} else {
		name = 'main';
	}

	return this.hosts[name];
};

// Create a new mirror or return an existing one
Server.prototype.mirror = function (port, options, callback) {

	var mirror = null;

	// Make parameters optional
	if (typeof port === 'number') {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		} else if (!options || typeof options !== 'object') {
			options = {};
			callback = null;
		}
	} else if (port && typeof port === 'object') {

		// Make options argument optional
		if (typeof options === 'function') {
			callback = options;
		} else {
			callback = null;
		}

		// Get the options from the port argument
		options = port;

		// Set default port for HTTP and HTTPS if no port was defined
		if (options.https) {
			port = 443;
		} else {
			port = 80;
		}
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
		options = {};
	} else {
		port = 80;
		options = {};
		callback = null;
	}

	// Create a new mirror only if the current port is free
	if (!this.mirrors[port]) {

		// Create the new mirror with the provided port and options
		this.mirrors[port] = mirror = new Mirror(this, port, options);

		// Start the current mirror only if the server is started
		if (this.started) {
			this.mirrors[port].start(callback);
		}
	}

	return mirror;
};

// Start or restart the server
Server.prototype.start = function (port, callback) {

	var that = this;

	// Set the internal instance to listen the defined port
	function start() {

		var args = [],
			instance = that.instance;

		// Set the port and the status flags
		that.busy = true;
		that.port = port;
		that.started = true;

		// Add the port to the arguments
		args.push(port);

		// If there is a hostname defined add it to the arguments
		if (that.hostname) {
			args.push(that.hostname);
		}

		// If there is a backlog defined add it to the arguments
		if (that.backlog) {
			args.push(that.backlog);
		}

		// Add the callback to listen the server start
		args.push(function () {
			that.busy = false;
			utils.runFunction(callback, that);
			that.emit('start', that);
			that.emit('release');
		});

		// Start listening by applying the defined arguments
		instance.listen.apply(instance, args);
	}

	// Make parameters optional
	if (typeof port === 'function') {
		callback = port;
		port = this.port;
	} else if (typeof port !== 'number') {
		port = this.port;
		callback = null;
	}

	// Check for the internal instance status and start or restart it
	if (this.busy) {
		this.once('release', function () {
			that.start(port, callback);
		});
	} else if (this.started && port !== this.port) {
		this.stop(start);
	} else {
		start();
	}

	return this;
};

// Stop the server
Server.prototype.stop = function (callback) {

	var that = this;

	// Check for the internal instance status and stop it only if it is started
	if (this.busy) {
		this.once('release', function () {
			that.stop(callback);
		});
	} else if (this.started) {

		// Set status flags
		this.busy = true;
		this.started = false;

		// Close the internal instance
		this.instance.close(function () {
			that.busy = false;
			utils.runFunction(callback, that);
			that.emit('stop', that);
			that.emit('release');
		});
	} else {
		utils.runFunction(callback, this);
	}

	return this;
};

module.exports = Server;