'use strict';

var fs = require('fs'),
	http = require('http'),
	httpConnection = require('./lib/http/connection'),
	https = require('https'),
	host = require('./lib/http/host'),
	url = require('url'),
	utils = require('./utils/utils'),
	wsConnection = require('./lib/ws/connection');

// SimpleS prototype constructor
var simples = function (port, options) {

	var aux,
		server,
		that = this;

	// The listener for the HTTP requests
	function requestListener(request, response) {

		var host = that.hosts[request.headers.host.split(':')[0]];

		// Get the main host if the other one does not exist or is inactive
		if (!host || !host.active) {
			host = that.hosts.main;
		}

		// Create the HTTP connection
		new httpConnection(host, request, response);
	}

	// Set the port to be optional
	if (typeof port !== 'number' && typeof port !== 'string') {
		if (port && typeof port === 'object') {
			options = port;
		} else {
			port = 80;
		}
	}

	// Prepare the server
	if (options) {

		// Always listen HTTPS on port 443
		port = 443;

		// Check for HTTPS data
		if (!options.cert && !options.key || !options.pfx) {
			throw new Error('simpleS: Invalid data for the HTTPS server');
		}

		// Get the data for the HTTPS server
		try {
			options.cert = options.cert && fs.readFileSync(options.cert);
			options.key = options.key && fs.readFileSync(options.key);
			options.pfx = options.pfx && fs.readFileSync(options.pfx);
		} catch (error) {
			throw new Error('simpleS: Can not read data for the HTTPS server');
		}

		// Create the HTTP and the HTTPS servers
		server = https.Server(options, requestListener);
		aux = http.Server(requestListener);

		// Catch the errors in the auxiliary HTTP server
		aux.on('error', function (error) {
			that.busy = false;
			that.started = false;
			throw new Error('simpleS: HTTP server error > ' + error.message);
		});

		// Manage the HTTP server depending on HTTPS events
		server.on('open', function () {
			aux.listen(80);
		}).on('close', function () {
			aux.close();
		});
	} else {
		server = http.Server(requestListener);
	}

	// Listen for server events error, release and upgrade related to WebSocket
	server.on('error', function (error) {
		that.busy = false;
		that.started = false;
		throw new Error('simpleS: Server error > ' + error.message);
	}).on('release', function (callback) {
		that.busy = false;

		// Call the callback when the server is free
		if (callback) {
			callback.call(that);
		}
	}).on('upgrade', function (request, socket) {

		var error,
			host = that.hosts[request.headers.host.split(':')[0]],
			parsedUrl = url.parse(request.url, true),
			wsHost;

		// Set socket keep alive time to 25 seconds
		socket.setTimeout(25000);

		// Get the main host if the other one does not exist or is inactive
		if (!host || !host.active) {
			host = that.hosts.main;
		}

		// Select the WebSocket host
		wsHost = host.wsHosts[parsedUrl.pathname];

		error = utils.validateWS(host, wsHost, request);

		// Check for error and create the WebSocket connection
		if (error) {
			console.error(error);
			socket.destroy();
		} else {
			new wsConnection(host, wsHost, request);
		}
	});

	// Set simpleS properties
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
			value: server
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Call host in this context and set it as the main host
	host.call(this, this, 'main');

	// Start the server on the provided port
	this.start();
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Create a new host
simples.prototype.host = function (name) {
	return new host(this, name);
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
	if (typeof port !== 'number' && typeof port !== 'string') {
		if (typeof port === 'function') {
			callback = port;
		}
		port = this.port;
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