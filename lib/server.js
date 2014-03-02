'use strict';

var crypto = require('crypto'),
	events = require('events'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	wsConnection = require('simples/lib/ws/connection');

// HTTP server prototype contructor
var server = function (parent, port, options) {

	var that = this;

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Prepare the internal objects and flags
	this.busy = false;
	this.parent = parent;
	this.port = port;
	this.secured = false;
	this.started = false;

	// Unblock the parent instance on server release
	this.on('release', function (callback) {

		// Remove busy flag
		this.busy = false;

		// Call the callback function when the server is free
		if (callback) {
			callback.call(parent);
		}
	});

	// Create the internal instance server
	if (options && (options.cert && options.key || options.pfx)) {
		server.getCertificates(options, function () {
			that.secured = true;
			that.instance = https.Server(options);
			that.secondary = http.Server();
			that.addListeners();
		});
	} else if (!options) {
		this.instance = http.Server();
		this.addListeners();
	} else {
		throw new Error('simpleS: Invalid data for the HTTPS server');
	}
};

// Read the certificates for the HTTPS server
server.getCertificates = function (options, callback) {

	var files = [];

	// Listener for file reading end
	function onFileRead(error, content) {

		// Check for error on reading files
		if (error) {
			console.error('\nsimpleS: Can not read SSL certificates');
			throw error;
		}

		// Set the content of the file in the options object
		options[files.shift()] = content;

		// Read the next file or call the callback function
		if (files.length) {
			fs.readFile(options[files[0]], onFileRead);
		} else {
			callback();
		}
	}

	// Filter options attributes for certificates files
	files = Object.keys(options).filter(function (element) {
		return ['cert', 'key', 'pfx'].indexOf(element) >= 0;
	});

	// Read the first file
	if (files.length) {
		fs.readFile(options[files[0]], onFileRead);
	} else {
		throw new Error('simpleS: No SSL certificates defined');
	}
};

// Returns the host object depending on the request
server.getHost = function (instance, request) {

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
		host = host.wsHosts[hostname];
	}

	return host;
};

// Inherit from events.EventEmitter
server.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: server
	}
});

// Add event listeners to the internal instances
server.prototype.addListeners = function () {

	var that = this;

	// Listener for HTTP requests
	function onRequest(request, response) {

		var host = server.getHost(that.parent, request);

		// Set the keep alive timeout of the request socket to 5 seconds
		request.connection.setTimeout(5000);

		// Set the default content type to HTML and charset UTF-8
		response.setHeader('Content-Type', 'text/html;charset=utf-8');

		// Process the received request
		utils.http.requestListener(host, request, response);
	}

	// Listener for WS requests
	function onUpgrade(request, socket) {

		var connection = null,
			error = '',
			host = server.getHost(that.parent, request),
			key = request.headers['sec-websocket-key'],
			parent = host.parent;

		// Check for WS errors
		if (!host) {
			error = '\nsimpleS: Request to an inexistent WebSocket host\n';
		} else if (request.headers.upgrade !== 'websocket') {
			error = '\nsimpleS: Unsupported WebSocket upgrade header\n';
		} else if (!key) {
			error = '\nsimpleS: No WebSocket handshake key\n';
		} else if (request.headers['sec-websocket-version'] !== '13') {
			error = '\nsimpleS: Unsupported WebSocket version\n';
		} else if (!utils.accepts(parent, request)) {
			error = '\nsimpleS: WebSocket origin not accepted\n';
		}

		// Check for error and make the WS handshake
		if (error) {
			console.error(error);
			socket.destroy();
		} else {

			// Create a new WS connection
			connection = new wsConnection(host, request);

			// Push the connection to the host connections set
			host.connections.push(connection);

			// Prepare WS handshake based on the provided key
			utils.ws.prepareHandshake(connection, key);
		}
	}

	// Stop the server on fatal error
	this.on('error', function (error) {
		that.busy = false;
		that.started = false;
		console.error('\nsimpleS: Server error');
		throw error;
	});

	// Listen for HTTP server close event to emit it to the main server
	this.instance.on('close', function () {
		that.emit('close');
	}).on('error', function (error) {
		console.error('simpleS: Error inside the main server');
		that.emit('error', error);
	});

	// Attach the request listeners to the HTTP server instance
	this.instance.on('request', onRequest).on('upgrade', onUpgrade);

	// Check for secondary HTTP server
	if (this.secondary) {

		// Attach the request listeners to the secondary HTTP server instance
		this.secondary.on('request', onRequest).on('upgrade', onUpgrade);

		// Listen for errors of the secondary HTTP server instance
		this.secondary.on('error', function (error) {
			console.error('simpleS: Error inside the secondary server');
			that.emit('error', error);
		});

		// Manage the HTTP server depending on HTTPS server events
		this.on('open', function () {
			this.secondary.listen(80);
		}).on('close', function () {
			this.secondary.close();
		});
	}

	// Emit that the server is ready to receive requests
	this.emit('ready');
};

// Call the close method of the internal instance
server.prototype.close = function (callback) {

	var that = this;

	// Set status flags
	this.busy = true;
	this.started = false;

	// On server instance close emit release event
	this.instance.close(function () {
		that.emit('release', callback);
	});
};

// Call the listen method of the internal instance
server.prototype.listen = function (port, callback) {

	var that = this;

	// Set status flags, port
	this.busy = true;
	this.port = port;
	this.started = true;

	// Emit open event if secondary server exists
	if (this.secondary) {
		this.emit('open');
	}

	// On server instance port listening emit release event
	this.instance.listen(port, function () {
		that.emit('release', callback);
	});
};

module.exports = server;