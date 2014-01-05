'use strict';

var crypto = require('crypto'),
	events = require('events'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	httpConnection = require('simples/lib/http/connection'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	wsConnection = require('simples/lib/ws/connection');

var server = function (parent, port, options) {

	var that = this;

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Prepare the internal objects and flags
	this.busy = false;
	this.instance = null;
	this.parent = parent;
	this.port = port;
	this.secondary = null;
	this.secured = false;
	this.started = false;

	// Unblock the parent instance on server release
	this.on('release', function (callback) {

		// Remove busy flag
		that.busy = false;

		// Call the callback when the server is free
		if (callback) {
			callback.call(parent);
		}
	});

	// Create the internal instance server
	if (options && (options.cert && options.key || options.pfx)) {
		this.getCertificates(options, function () {
			that.secured = true;
			that.instance = https.Server(options);
			that.secondary = http.Server();
			that.addListeners();
		});
	} else if (!options) {
		that.instance = http.Server();
		that.addListeners();
	} else {
		throw new Error('simpleS: Invalid data for the HTTPS server');
	}
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

	// Stop the server on fatal error
	this.on('error', function (error) {
		that.busy = false;
		that.started = false;
		throw new Error('simpleS: Server error > ' + error.message);
	});

	// Attach the event listeners to the HTTP server instance
	this.instance.on('close', function () {
		that.emit('close');
	}).on('error', function (error) {
		that.emit('error', error);
	}).on('request', function (request, response) {
		that.httpRequestListener(that.getHost(request), request, response);
	}).on('upgrade', function (request, socket) {
		that.wsRequestListener(that.getHost(request), request, socket);
	});

	// Check for secondary HTTP server
	if (this.secondary) {

		// Catch the errors and listen for upgrade in the secondary HTTP server
		this.secondary.on('error', function (error) {
			that.emit('error', error);
		}).on('request', function (request, response) {
			that.httpRequestListener(that.getHost(request), request, response);
		}).on('upgrade', function (request, socket) {
			that.wsRequestListener(that.getHost(request), request, socket);
		});

		// Manage the HTTP server depending on HTTPS server events
		this.on('open', function () {
			this.secondary.listen(80);
		}).on('close', function () {
			this.secondary.close();
		});
	}

	// Emit that server is ready to receive requests
	this.emit('ready');
};

// Call the close method of the internal instance
server.prototype.close = function (callback) {
	this.busy = true;
	this.started = false;
	this.instance.close(callback);
};

// Generate hash from data and send it to the callback
server.prototype.generateHash = function (data, callback) {

	var hash = new Buffer(0);

	// Hash received data
	crypto.Hash('sha1').on('readable', function () {

		var chunk = this.read() || new Buffer(0);

		// Append data to the hash
		hash = utils.buffer(hash, chunk, hash.length + chunk.length);
	}).on('end', function () {
		callback(hash);
	}).end(data);
};

// Read the certificates for the HTTPS server
server.prototype.getCertificates = function (options, callback) {

	var files = [];

	// Filter options attributes for certificates files
	files = Object.keys(options).filter(function (element) {
		return ['cert', 'key', 'pfx'].indexOf(element) >= 0;
	});

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

	// Read the first file
	if (files.length) {
		fs.readFile(options[files[0]], onFileRead);
	} else {
		throw 'simpleS: No SSL certificates defined';
	}
};

// Returns the host object depending on the request
server.prototype.getHost = function (request) {

	var header = request.headers.host,
		host = null,
		parent = this.parent;

	// Check if host is provided by the host header
	if (header) {
		host = parent.hosts[header.split(':')[0]];
	}

	// Get the HTTP host
	host = host || parent.hosts.main;

	// Check for WS host
	if (request.headers.upgrade) {
		host = host.wsHosts[url.parse(request.url).pathname];
	}

	return host;
};

// Request listener for simple HTTP requests
server.prototype.httpRequestListener = function (host, request, response) {

	var config = host.conf,
		connection = null,
		session = '',
		that = this;

	// Prepare session object, timers and write cookies
	function setSession(hash) {

		var options = {
			domain: connection.host,
			expires: config.session.timeout,
			httpOnly: true,
			path: '/'
		};

		// Set current session object
		connection.session = host.sessions[session];

		// Clear the previous session timer and create a new one
		clearTimeout(host.timers[session]);
		host.timers[session] = setTimeout(function () {
			delete host.sessions[session];
			delete host.timers[session];
		}, config.session.timeout * 1000);

		// Write the session cookies
		connection.cookie(config.session.hash, hash.toString('hex'), options);
		connection.cookie(config.session.key, session, options);

		// Continue to process the request
		utils.http.requestListener(host, connection);
	}

	// Create a new HTTP connection
	connection = new httpConnection(host, request, response);

	// Get the session key
	if (connection.cookies[config.session.key]) {
		session = connection.cookies[config.session.key];
	}

	// Generate session if it does not exists
	if (!session || !host.sessions[session]) {
		session = utils.generateSessionName();
		host.sessions[session] = {};
	}

	// Prepare session
	if (config.session.enabled) {
		this.generateHash(session + config.session.secret, function (hash) {

			var cookies = connection.cookies,
				data = config.session;

			// Transform hash to hexadecimal format
			hash = hash.toString('hex');

			// Validate session cookie
			if (hash !== cookies[data.hash] && session === cookies[data.key]) {
				session = utils.generateSessionName();
				host.sessions[session] = {};
				that.generateHash(session + config.session.secret, setSession);
			} else {
				setSession(hash);
			}
		});
	} else {
		utils.http.requestListener(host, connection);
	}
};

// Call the listen method of the internal instance
server.prototype.listen = function (port, callback) {
	this.busy = true;
	this.port = port;
	this.started = true;
	this.emit('open');
	this.instance.listen(port, callback);
};

// Request listener for HTTP requests with upgrade header for WS
server.prototype.wsRequestListener = function (host, request, socket) {

	var config = host.parent.conf,
		connection = null,
		error = '',
		key = request.headers['sec-websocket-key'],
		session = '',
		that = this;

	// Write the upgrade head for WS
	function writeHead(handshake, hash) {

		var head = [],
			expires = ';expires=',
			domain = connection.host,
			params = '',
			timeout = 3600000;

		// Check for session timeout definition
		if (config.session.timeout) {
			timeout = config.session.timeout * 1000;
		}

		// Prepare the domain parameter
		if (connection.host.indexOf('.') < 0) {
			domain = '';
		}

		// Prepare the parameters for the session cookies
		expires += new Date(Date.now() + timeout).toUTCString();
		params = expires + ';path=/;domain=' + domain + ';httponly';

		// Prepare the head
		head = [
			'HTTP/1.1 101 Web Socket Protocol Handshake',
			'Connection: Upgrade',
			'Upgrade: WebSocket',
			'Sec-WebSocket-Accept: ' + handshake,
			'Sec-Websocket-Protocol: ' + connection.protocols,
			'Origin: ' + connection.headers.origin,
			'Set-Cookie: ' + config.session.key + '=' + session + params,
			'Set-Cookie: ' + config.session.hash + '=' + hash + params
		];

		// Clear the previous session timer and create a new one
		clearTimeout(host.parent.timers[session]);
		host.parent.timers[session] = setTimeout(function () {
			delete host.parent.sessions[session];
			delete host.parent.timers[session];
		}, timeout);

		// Write the handshake head of the response
		socket.write(head.join('\r\n') + '\r\n\r\n');
	}

	// Prepare the session object
	function prepareSession(hash) {

		// Set current session object
		connection.session = host.parent.sessions[session];

		// Prepare the key for the handshake
		key += '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

		// Prepare the handshake hash
		that.generateHash(key, function (handshake) {
			writeHead(handshake.toString('base64'), hash.toString('hex'));
			utils.ws.requestListener(host, connection);
		});
	}

	// Validate hash for session
	function validateHash(hash) {

		var cookies = connection.cookies,
			data = config.session;

		// Transform hash to hexadecimal format
		hash = hash.toString('hex');

		// Validate session cookie
		if (hash !== cookies[data.hash] && session === cookies[data.key]) {
			session = utils.generateSessionName();
			host.sessions[session] = {};
			that.generateHash(session + config.session.secret, prepareSession);
		} else {
			prepareSession(hash);
		}
	}

	// Check for WS errors
	if (!host) {
		error = '\nsimpleS: Request to an inexistent WebSocket host\n';
	} else if (request.headers.upgrade !== 'websocket') {
		error = '\nsimpleS: Unsupported WebSocket upgrade header\n';
	} else if (!key) {
		error = '\nsimpleS: No WebSocket handshake key\n';
	} else if (request.headers['sec-websocket-version'] !== '13') {
		error = '\nsimpleS: Unsupported WebSocket version\n';
	} else if (!utils.accepts(host.parent, request)) {
		error = '\nsimpleS: WebSocket origin not accepted\n';
	}

	// Check for error and make the WS handshake
	if (error) {
		console.error(error);
		socket.destroy();
	} else {

		// Create a new WebSocket connection and push it to the list
		connection = new wsConnection(host.parent, host.conf, request);
		host.connections.push(connection);

		// Get the session key
		if (connection.cookies[config.session.key]) {
			session = connection.cookies[config.session.key];
		}

		// Generate session if it does not exists
		if (!session || !host.parent.sessions[session]) {
			session = utils.generateSessionName();
			host.parent.sessions[session] = {};
		}

		// Get the hash for session
		this.generateHash(session + config.session.secret, validateHash);
	}
};

module.exports = server;