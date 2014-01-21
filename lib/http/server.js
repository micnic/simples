'use strict';

var events = require('events'),
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
		this.instance = http.Server();
		this.addListeners();
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

// Read the certificates for the HTTPS server
server.prototype.getCertificates = function (options, callback) {

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

// Generate the session container
server.prototype.getSession = function (host, connection, callback) {

	var chrs = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
		config = host.conf,
		session = connection.cookies[config.session.key];

	// Generate a random 16 characters length string
	function generateId() {

		var count = 16,
			id = '';

		// Append a random character to the id
		while (count--) {
			id += chrs[Math.random() * 62 | 0];
		}

		return id;
	}

	// Prepare session object, timers and write cookies
	function setSession(hash) {

		// Set current session object
		connection.session = host.sessions[session];

		// Clear the previous session timer and create a new one
		clearTimeout(host.timers[session]);
		host.timers[session] = setTimeout(function () {
			delete host.sessions[session];
			delete host.timers[session];
		}, config.session.timeout * 1000);

		// Send the session id and the hash to the callback function
		callback(session, hash.toString('hex'));
	}

	// Generate new session if it does not exist
	if (!session || !host.sessions[session]) {
		session = generateId();
		host.sessions[session] = {};
	}

	// Validate hash for session
	utils.generateHash(session + config.session.secret, function (hash) {

		var cookies = connection.cookies,
			data = config.session;

		// Transform hash to hexadecimal format
		hash = hash.toString('hex');

		// Validate session cookie
		if (hash !== cookies[data.hash] && session === cookies[data.key]) {
			session = generateId();
			host.sessions[session] = {};
			utils.generateHash(session + config.session.secret, setSession);
		} else {
			setSession(hash);
		}
	});
};

// Request listener for simple HTTP requests
server.prototype.httpRequestListener = function (host, request, response) {

	var config = host.conf,
		connection = null;

	// Create a new HTTP connection
	connection = new httpConnection(host, request, response);

	// Check if session is enabled
	if (config.session.enabled) {
		this.getSession(host, connection, function (session, hash) {

			var options = {};

			// Prepare cookies options
			options.expires = config.session.timeout;
			options.httpOnly = true;

			// Write the session cookies
			connection.cookie(config.session.hash, hash, options);
			connection.cookie(config.session.key, session, options);

			// Continue to process the request
			utils.http.requestListener(host, connection);
		});
	} else {
		utils.http.requestListener(host, connection);
	}
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

// Request listener for HTTP requests with upgrade header for WS
server.prototype.wsRequestListener = function (host, request, socket) {

	var config = host.parent.conf,
		connection = null,
		error = '',
		key = request.headers['sec-websocket-key'];

	// Write the upgrade head for WS
	function writeHead(handshake, trail) {

		var head = '';

		// Prepare the head
		head += 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n';
		head += 'Connection: Upgrade\r\n';
		head += 'Upgrade: WebSocket\r\n';
		head += 'Sec-WebSocket-Accept: ' + handshake + '\r\n';
		head += 'Sec-Websocket-Protocol: ' + connection.protocols + '\r\n';
		head += 'Origin: ' + connection.headers.origin + '\r\n';

		// Add session cookies if are defined
		if (trail) {
			head += trail;
		}

		// Append the end of the head
		head += '\r\n';

		// Write the handshake head of the response
		socket.write(head);
	}

	// Prepare the session object
	function prepareHandshake(trail) {

		// Prepare the key for the handshake
		key += '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

		// Prepare the handshake hash
		utils.generateHash(key, function (handshake) {
			writeHead(handshake.toString('base64'), trail);
			utils.ws.requestListener(host, connection);
		});
	}

	// Prepare data for session cookies
	function prepareSession(session, hash) {

		var conf = config.session,
			expires = '',
			params = '',
			trail = '';

		// Prepare the parameters for the session cookies
		expires += new Date(Date.now() + conf.timeout * 1000).toUTCString();
		params = ';expires=' + expires + ';httponly';

		// Append session cookies to the head
		trail += 'Set-Cookie: ' + conf.key + '=' + session + params + '\r\n';
		trail += 'Set-Cookie: ' + conf.hash + '=' + hash + params + '\r\n';

		// Continue with WS handshake
		prepareHandshake(trail);
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

		// Check if session is enabled
		if (config.session.enabled) {
			this.getSession(host.parent, connection, prepareSession);
		} else {
			prepareHandshake();
		}
	}
};

module.exports = server;