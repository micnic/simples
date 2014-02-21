'use strict';

var crypto = require('crypto'),
	events = require('events'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	httpConnection = require('simples/lib/http/connection'),
	session = require('simples/lib/session'),
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

// Generate session id and hash
server.generateSession = function (host, connection, callback) {

	var config = host.conf.session,
		instance = new session(config.timeout);

	// Generate a random session id of 20 bytes
	crypto.randomBytes(20, function (error, buffer) {

		// Check for error, which, eventually, should never happen(!)
		if (error) {
			console.error('\nsimpleS: can not generate random bytes');
			throw error;
		}

		// Set session id and append the session container to the connection
		instance.id = buffer.toString('hex');
		host.sessions[instance.id] = instance;
		connection.session = instance.container;

		// Generate the session hash
		utils.generateHash(instance.id + config.secret, 'hex', function (hash) {
			instance.hash = hash;
			callback(connection, instance.id, instance.hash);
		});
	});
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

// Generate the session container
server.getSession = function (host, connection, callback) {

	var cookies = connection.cookies;

	// Generate new session if it does not exist
	if (!cookies._session || !host.sessions[cookies._session]) {
		server.generateSession(host, connection, callback);
	} else {
		if (host.sessions[cookies._session].hash !== cookies._hash) {
			delete host.sessions[cookies._session];
			server.generateSession(host, connection, callback);
		} else {
			connection.session = host.sessions[cookies._session].container;
			host.sessions[cookies._session].update();
			callback(connection, cookies._session, cookies._hash);
		}
	}
};

// Set the session cookies for HTTP requests
server.setHttpSession = function (connection, sid, hash) {

	var config = connection.parent.conf,
		host = connection.parent,
		options = {};

	// Prepare cookies options
	options.expires = config.session.timeout;
	options.httpOnly = true;

	// Write the session cookies
	connection.cookie('_session', sid, options);
	connection.cookie('_hash', hash, options);

	// Continue to process the request
	utils.http.requestListener(connection);
};

// Set the session cookies for WS requests
server.setWsSession = function (connection, sid, hash) {

	var config = null,
		expires = 0,
		host = connection.parent,
		parent = host.parent;

	// Prepare expiration time for the session cookies
	config = parent.conf.session;
	expires = utils.utc(config.timeout);

	// Add the session cookies to the connection head
	connection.head += 'Set-Cookie: _session=' + sid + ';';
	connection.head += 'expires=' + session.expires + ';httponly\r\n';
	connection.head += 'Set-Cookie: _hash=' + hash + ';';
	connection.head += 'expires=' + session.expires + ';httponly\r\n';

	// Continue to process the request
	utils.ws.requestListener(connection);
};

// Prepare the handshake hash
server.wsPrepareHandshake = function (connection, key) {

	var host = connection.parent,
		parent = host.parent;

	utils.generateHash(key + utils.ws.guid, 'base64', function (handshake) {

		var config = parent.conf.session,
			protocols = connection.protocols.join(', ');

		// Prepare the connection head
		connection.head += 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n';
		connection.head += 'Connection: Upgrade\r\n';
		connection.head += 'Upgrade: WebSocket\r\n';
		connection.head += 'Origin: ' + connection.headers.origin + '\r\n';
		connection.head += 'Sec-WebSocket-Accept: ' + handshake + '\r\n';

		// Add the connection subprotocols to the connection head
		if (protocols) {
			connection.head += 'Sec-Websocket-Protocol: ' + protocols + '\r\n';
		}

		// Prepare session
		if (config.enabled) {
			server.getSession(parent, connection, server.setWsSession);
		} else {
			utils.ws.requestListener(connection);
		}
	});
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

		var connection = null,
			config = null,
			host = server.getHost(that.parent, request);

		// Create a new HTTP connection
		connection = new httpConnection(host, request, response);

		// Shortcut to host configuration
		config = host.conf;

		// Prepare session
		if (config.session.enabled) {
			server.getSession(host, connection, server.setHttpSession);
		} else {
			utils.http.requestListener(connection);
		}
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
			server.wsPrepareHandshake(connection, key);
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