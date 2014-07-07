'use strict';

var fs = require('fs'),
	host = require('simples/lib/http/host'),
	http = require('http'),
	https = require('https'),
	store = require('simples/lib/store'),
	url = require('url'),
	utils = require('simples/utils/utils');

// SimpleS prototype constructor
var simples = function (port, options, callback) {

	var that = this;

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
			value: port,
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

	// Create the internal instance server
	if (utils.isObject(options)) {
		simples.getCertificates(options, function (result) {
			that.secured = true;
			that.instance = https.Server(result);
			that.secondary = http.Server();
			simples.addListeners(that);
			that.start(callback);
		});
	} else {
		this.instance = http.Server();
		simples.addListeners(that);
		this.start(callback);
	}
};

// Add event listeners to the internal instances
simples.addListeners = function (server) {

	// Listener for fatal errors
	function onError(error) {
		server.busy = false;
		server.started = false;
		console.error('\nsimpleS: Server error\n');
		throw error;
	}

	// Listener for HTTP requests
	function onRequest(request, response) {

		var host = simples.getHost(server, request);

		// Process the received request
		utils.http.connectionListener(host, request, response);
	}

	// Listener for WS requests
	function onUpgrade(request, socket) {

		var host = simples.getHost(server, request);

		// Create a new WS connection if the host is defined
		if (host) {
			utils.ws.connectionListener(host, request);
		} else {
			console.error('\nsimpleS: Request to inexistent WebSocket host\n');
			socket.destroy();
		}
	}

	// Attach the listeners for the primary HTTP server instance
	server.instance.on('release', function (callback) {

		// Remove busy flag
		server.busy = false;

		// Call the callback function when the server is free
		if (callback) {
			callback();
		}
	}).on('error', onError).on('request', onRequest).on('upgrade', onUpgrade);

	// Check for secondary HTTP server
	if (server.secondary) {

		// Manage the HTTP server depending on HTTPS server events
		server.instance.on('open', function () {
			server.secondary.listen(80);
		}).on('close', function () {
			server.secondary.close();
		});

		// Attach the listeners for the secondary HTTP server instance
		server.secondary.on('error', function (error) {
			console.error('\nsimpleS: Error inside the secondary HTTP server');
			server.instance.emit('error', error);
		}).on('request', onRequest).on('upgrade', onUpgrade);
	}
};

// Read the certificates for the HTTPS server
simples.getCertificates = function (options, callback) {

	var files = [],
		result = {};

	// Listener for file reading end
	function onFileRead(error, content) {

		// Check for error on reading files
		if (error) {
			console.error('\nsimpleS: Can not read SSL certificates');
			throw error;
		}

		// Set the content of the file in the options object
		result[files.shift()] = content;

		// Read the next file or call the callback function
		if (files.length) {
			fs.readFile(result[files[0]], onFileRead);
		} else {
			callback(result);
		}
	}

	// Process options members
	Object.keys(options).forEach(function (element) {

		// Get certificate file names
		if (['cert', 'key', 'pfx'].indexOf(element) >= 0) {
			files.push(element);
		}

		// Copy options members
		result[element] = options[element];
	});

	// Read the first file
	if (files.length) {
		fs.readFile(result[files[0]], onFileRead);
	} else {
		throw new Error('simpleS: No SSL certificates defined');
	}
};

// Returns the host object depending on the request
simples.getHost = function (instance, request) {

	var headers = request.headers,
		host = instance.hosts.main,
		hostname = '';

	// Check if host is provided by the host header
	if (headers.host) {

		// Get the host name
		hostname = headers.host.split(':')[0];

		// Check for existing HTTP host
		if (instance.hosts[hostname]) {
			host = instance.hosts[hostname];
		}
	}

	// Check for WS host
	if (headers.upgrade) {
		hostname = url.parse(request.url).pathname;
		host = host.routes.ws[hostname];
	}

	return host;
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
			this.hosts[name] = new host(this, name, config);
		}
	} else {
		name = 'main';
	}

	return this.hosts[name];
};

// Start simples server
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
		if (this.secured) {
			port = 443;
		}
		if (typeof callback === 'function`') {
			callback = null;
		}
	} else if (typeof port === 'function') {
		callback = port;
		if (this.secured) {
			port = 443;
		} else {
			port = this.port;
		}
	} else {
		port = this.port;
		callback = null;
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

		// Clear all existing hosts
		Object.keys(that.hosts).forEach(function (host) {
			that.hosts[host].close();
		});

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

	return new simples(port, options, callback);
};

// Create a new session store instance
exports.store = function () {
	return new store();
};