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

	var redirect,
		server,
		that = this;

	// The listener for the HTTP requests
	function requestListener(request, response) {

		var host = that.hosts[request.headers.host.split(':')[0]];

		// Get the main host if the other one does not exist or is inactive
		if (!host || !host.active) {
			host = that.hosts.main;
		}

		// Set up the HTTP connection
		new httpConnection(host, request, response);
	}

	// Set the port to be optional
	if (typeof port !== 'number' || typeof port !== 'string') {
		if (port && typeof port === 'object') {
			options = port;
			port = 443;
		} else {
			port = 80;
		}
	}

	// Prepare the server
	if (options) {

		// Set HTTPS port
		port = 443;

		// Check for HTTPS data
		if (!((options.cert && options.key) || options.pfx)) {
			console.log('\nsimpleS: not enough data for HTTPS\n');
			return;
		}

		// Get the data for the HTTPS server
		try {
			options.cert = options.cert && fs.readFileSync(options.cert);
			options.key = options.key && fs.readFileSync(options.key);
			options.pfx = options.pfx && fs.readFileSync(options.pfx);
		} catch (error) {
			console.log('\nsimpleS: can not read data for HTTPS');
			console.log(error.message + '\n');
			return;
		}

		// Create the HTTP and the HTTPS servers
		server = https.Server(options, requestListener);
		redirect = http.Server(requestListener);

		// Manage the HTTP server depending on HTTPS events
		server.on('open', function () {
			redirect.listen(80);
		}).on('close', function () {
			redirect.close();
		});
	} else {
		server = http.Server(requestListener);
	}

	// Listen for server events error, release and upgrade related to WebSocket
	server.on('error', function (error) {
		console.log('\nsimpleS: server error');
		console.log(error.message + '\n');
		that.started = false;
		that.busy = false;
	}).on('release', function (callback) {
		that.busy = false;
		if (callback) {
			callback.call(that);
		}
	}).on('upgrade', function (request, socket) {

		var connection,
			host,
			parsedUrl = url.parse(request.url, true),
			wsHost;

		// Set socket keep alive time to 25 seconds
		socket.setTimeout(25000);

		host = that.hosts[request.headers.host.split(':')[0]];

		// Get the main host if the other one does not exist or is inactive
		if (!host || !host.active) {
			host = that.hosts.main;
		}

		// Select the WebSocket host
		wsHost = host.wsHosts[parsedUrl.pathname];

		// Check for WebSocket host
		if (!wsHost || !wsHost.active) {
			console.log('\nsimpleS: received request to an inactive host\n');
			socket.destroy();
			return;
		}

		// Check for valid upgrade header
		if (request.headers.upgrade !== 'websocket') {
			console.log('\nsimpleS: unsupported upgrade header received\n');
			socket.destroy();
			return;
		}

		// Check for WebSocket handshake key
		if (!request.headers['sec-websocket-key']) {
			console.log('\nsimpleS: no WebSocket handshake key received');
			socket.destroy();
			return;
		}

		// Check for WebSocket subprotocols
		if (!request.headers['sec-websocket-protocol']) {
			console.log('\nsimpleS: no WebSocket subprotocols received');
			socket.destroy();
			return;
		}

		// Check for valid WebSocket protocol version
		if (request.headers['sec-websocket-version'] !== '13') {
			console.log('\nsimpleS: unsupported WebSocket version requested\n');
			socket.destroy();
			return;
		}

		// Check for accepted origin
		if (request.headers.origin && !utils.accepts(host, request)) {
			console.log('\nsimpleS: WebSocket origin not accepted\n');
			socket.destroy();
			return;
		}

		// Current connection object
		connection = new wsConnection(host, wsHost, request);

		// Append the connection to the WebSocket host
		wsHost.connections.push(connection);

		// Execute user defined code for the WebSocket host
		try {
			wsHost.callback.call(wsHost, connection);
		} catch (error) {
			console.log('\nsimpleS: error in WebSocket host');
			console.log(error.stack + '\n');
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
		Object.keys(that.hosts).forEach(function (element) {
			that.hosts[element].open();
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
		that.started = false;
		that.busy = true;

		// Close all existing hosts
		Object.keys(that.hosts).forEach(function (element) {
			that.hosts[element].close();
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

// Export a new simples instance
module.exports = function (port, options) {
	return new simples(port, options);
};