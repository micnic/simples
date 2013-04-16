var crypto = require('crypto'),
	fs = require('fs'),
	http = require('http'),
	httpConnection = require('./lib/http/connection'),
	https = require('https'),
	host = require('./lib/http/host'),
	mime = require('./utils/mime'),
	path = require('path'),
	url = require('url'),
	utils = require('./utils/utils'),
	wsConnection = require('./lib/ws/connection');

// SimpleS prototype constructor
var simples = function (port, options) {
	'use strict';

	var server,
		that = this;

	// Call host in this context and set it as the main host
	host.call(this, 'main');

	// The listener for the HTTP requests
	function requestListener(request, response) {

		var connection,
			get = request.method === 'GET' || request.method === 'HEAD',
			headers = request.headers,
			host,
			hostname = url.parse('http://' + headers.host).hostname,
			index,
			isHost = that.hosts[hostname],
			origin,
			parsedUrl = url.parse(request.url, true),
			post = request.method === 'POST',
			redirect,
			requestURL = parsedUrl.pathname.substr(1),
			routes;

		host = isHost && isHost.started && isHost || that.hosts.main;
		routes = host.routes;

		// CORS limitation
		if (headers.origin) {
			origin = url.parse('http://' + headers.origin).hostname;
			index = ~host.origins.indexOf(origin);
			origin = (index || host.origins[0] === '*' && !index) && origin;
			origin = origin || hostname;
			response.writeHead(200, {
				'Access-Control-Allow-Credentials': 'True',
				'Access-Control-Allow-Headers': 'Content-Type',
				'Access-Control-Allow-Methods': 'GET,HEAD,POST',
				'Access-Control-Allow-Origin': origin
			});
			response.end();
			return;
		}

		connection = new httpConnection(host, request, response);
		connection.host = hostname;
		connection.query = parsedUrl.query;
		connection.url = parsedUrl;

		// Route static files or their symbolic links
		function routeFiles(lastModified) {
			var code = 200,
				extension = path.extname(requestURL).substr(1),
				notModified = Number(headers['if-modified-since']) === lastModified;

			if (notModified) {
				code = 304;
			}
			response.writeHead(code, {
				'Content-Type': mime[extension] || mime['default'],
				'Last-Modified': lastModified
			});
			if (notModified) {
				connection.end();
			} else {
				utils.handleCache(that.cache, requestURL, connection);
			}
		}

		// Callback for stats of static path
		function statCallback(error, stats) {
			if (!error && (stats.isFile() || stats.isSymbolicLink())) {
				routeFiles(stats.mtime.valueOf());
			} else if (!error && routes.serve.callback && stats.isDirectory()) {
				routes.serve.callback.call(host, connection);
			} else {
				response.statusCode = 404;
				routes.error[404].call(host, connection);
			}
		}

		// Route static files and directories
		function staticRouting() {

			var referer = hostname,
				isBanned = false;

			// Verify referer
			if (headers.referer && host.referers.length) {
				referer = url.parse(headers.referer).hostname;
				index = ~host.referers.indexOf(referer);
				isBanned = host.referers[0] === '*' && index || !index;
			}

			// Response with 404 code to banned referers
			if (hostname !== referer && isBanned) {
				response.statusCode = 404;
				routes.error[404].call(host, connection);
				return;
			}

			// Check for client api file request
			if (requestURL === 'simples/client.js') {
				requestURL = __dirname + '/utils/client.js';
			} else {
				requestURL = path.join(routes.serve.path, requestURL);
			}

			// Verify the stats of the path
			fs.stat(requestURL, statCallback);
		}

		// Routing for parametrized urls and static files
		function advancedRouting() {
			var urlSlices = requestURL.split('/'),
				found = utils.findAdvancedRoute(routes.all.advanced, urlSlices);

			// Search for an advanced route in all, get and post routes
			if (!found.route && get) {
				found = utils.findAdvancedRoute(routes.get.advanced, urlSlices);
			} else if (!found.route && post) {
				found = utils.findAdvancedRoute(routes.post.advanced, urlSlices);
			}

			// Apply callback if found one
			if (found.route) {
				connection.params = found.params;
				found.route.callback.call(host, connection);
			} else if (get && (routes.serve.path || requestURL === 'simples/client.js')) {
				staticRouting();
			} else {
				response.statusCode = 404;
				routes.error[404].call(host, connection);
			}
		}

		// All requests routing
		function routing() {
			if ((get || post) && routes.all.raw[requestURL]) {
				routes.all.raw[requestURL].call(host, connection);
			} else if (get && routes.get.raw[requestURL]) {
				routes.get.raw[requestURL].call(host, connection);
			} else if (post && routes.post.raw[requestURL]) {
				routes.post.raw[requestURL].call(host, connection);
			} else if (get || post) {
				advancedRouting();
			} else {
				response.writeHead(405, {
					'Allow': 'GET,HEAD,POST'
				});
				routes.error[405].call(host, connection);
			}
		}

		// Handler for internal errors of the server
		function errorHandler(error) {
			console.log('simpleS: Internal Server Error > "' + request.url + '"');
			console.log(error.stack + '\n');
			response.statusCode = 500;
			try {
				routes.error[500].call(host, connection);
			} catch (stop) {
				console.log('simpleS: can not apply route for error 500');
				console.log(stop.stack + '\n');
			}
		}

		// Set the keep alive timeout of the socket to 5 seconds
		request.connection.setTimeout(5000);

		// Wait for string data from the request
		request.setEncoding('utf8');

		// Populate the body of the connection when the request is readable
		request.on('readable', function () {
			connection.body += this.read();
		});

		// Start acting when the request ended
		request.on('end', function () {

			// Populate the files and the query of POST requests
			if (this.method === 'POST') {
				utils.parsePOST(this, connection);
			}

			// Vulnerable code handling
			try {
				routing();
			} catch (error) {
				errorHandler(error);
			}
		});
	}

	// Prepare the server
	if (options && options.key && options.cert) {

		// Create the key and the certificate for HTTPS server
		try {
			options.key = fs.readFileSync(options.key);
			options.cert = fs.readFileSync(options.cert);
			server = https.Server(options, requestListener);
			if (options.redirect) {
				redirect = http.Server(function (request, response) {
					response.writeHead(302, {
						'Location': 'https://' + url.parse(request.headers.host).hostname + request.url
					}).listen(80);
				});
			}
		} catch (error) {
			console.log('simpleS: Could not read data for HTTPS');
			console.log('HTTP server will be created on port ' + port);
			console.log(error.message + '\n');
			server = http.Server(requestListener);
			return;
		}
	} else {
		server = http.Server(requestListener);
	}

	// Catch runtime errors
	server.on('error', function (error) {
		console.log('simpleS: Server Error');
		console.log(error.message + '\n');
		that.started  = false;
		that.busy = false;
	});

	// Inform when the server is not busy
	server.on('release', function (callback) {
		that.busy = false;
		if (callback) {
			callback.call(that);
		}
	});

	// Listen for upgrade connections dedicated for WebSocket
	server.on('upgrade', function (request, socket) {

		// Set socket keep alive time to 25 seconds
		socket.setTimeout(25000);

		// Prepare data for WebSocket host
		var config,
			closeData = new Buffer([136, 0]),
			connection,
			dataBuffer = new Buffer(0),
			fin,
			handshake,
			hash,
			headers = request.headers,
			host,
			hostname = url.parse('http://' + headers.host).hostname,
			i,
			index,
			isHost = that.hosts[hostname],
			keepAliveTimer,
			key,
			mask,
			maskingKey,
			message = new Buffer(0),
			opcode,
			origin,
			parseState = 0,
			payloadData,
			payloadLength,
			pingData = new Buffer([137, 0]),
			protocols,
			reserved,
			type,
			unknownType,
			wsHost;

		// Get the host
		host = isHost && isHost.started && isHost || that.hosts.main;
		wsHost = host.wsHosts[url.parse(request.url).path];

		// Inactive WebSocket host
		if (!wsHost || !wsHost.started) {
			socket.destroy();
			return;
		}

		// Shortcuts
		config = wsHost.config;
		if (headers.origin) {
			origin = url.parse(headers.origin).host;
			index = ~host.origins.indexOf(origin);
		}
		if (headers['sec-websocket-protocol']) {
			protocols = headers['sec-websocket-protocol'].split(/\s*,\s*/).sort();
		}

		// Check for valid connection handshake
		if (!headers.origin ||
			headers.upgrade !== 'websocket' ||
			headers['sec-websocket-version'] !== '13' ||
			!headers['sec-websocket-protocol'] ||
			headers.host !== origin &&
			(!index || host.origins[0] !== '*' && index) ||
			(protocols < config.protocols || protocols > config.protocols)) {
			socket.destroy();
			return;
		}

		// Prepare response hash
		hash = crypto.Hash('sha1');
		key = headers['sec-websocket-key'];
		hash.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'utf8');

		// WebSocket HandShake
		handshake = [
			'HTTP/1.1 101 Web Socket Protocol Handshake',
			'Connection: Upgrade',
			'Upgrade: WebSocket',
			'Sec-WebSocket-Accept: ' + hash.digest('base64'),
			'Sec-WebSocket-Protocol: ' + headers['sec-websocket-protocol'],
			'Origin: ' + headers.origin,
			'\r\n'
		].join('\r\n');
		socket.write(handshake);

		// Current connection object
		connection = new wsConnection(host, request, protocols);
		connection.raw = config.raw;

		connection.on('close', function () {
			clearTimeout(keepAliveTimer);
		});

		wsHost.connections.push(connection);
		try {
			wsHost.callback.call(host, connection);
		} catch (error) {
			console.log('\nsimpleS: error in WebSocket host');
			console.log(error.message + '\n');
		}

		// Process received data
		socket.on('readable', function () {

			// Buffer data
			dataBuffer = Buffer.concat([dataBuffer, this.read()]);

			// Wait for header
			if (parseState === 0 && dataBuffer.length >= 2) {

				// Header components
				fin = dataBuffer[0] & 128;
				opcode = dataBuffer[0] & 15;
				mask = dataBuffer[1] & 128;
				payloadLength = dataBuffer[1] & 127;

				// Extensions, unknown frame type or unmasked message
				reserved = dataBuffer[0] & 112;
				unknownType = (opcode > 2 && opcode < 8) || opcode > 10;
				if (reserved || unknownType || !mask) {
					this.end(closeData);
					return;
				}

				// Control frames should be <= 125 bits and not be fragmented
				if (opcode > 7 && opcode < 11 && (payloadLength > 125 || !fin)) {
					this.end(closeData);
					return;
				}

				// Extend payload length or wait for masking key
				if (payloadLength === 126) {
					parseState = 1;
				} else if (payloadLength === 127) {
					parseState = 2;
				} else {
					parseState = 3;
				}

				// Throw away header
				dataBuffer = dataBuffer.slice(2);
			}

			// Wait for 16bit, 64bit payload length or masking key
			if (parseState === 1 && dataBuffer.length >= 2) {
				payloadLength = dataBuffer[0] << 8 | dataBuffer[1];
				parseState = 3;
				dataBuffer = dataBuffer.slice(2);
			} else if (parseState === 2 && dataBuffer.length >= 8) {

				// Most significant bit  should not be 1
				if (dataBuffer[0] & 128) {
					this.end(closeData);
					return;
				}

				// Concatenate payload length
				payloadLength = dataBuffer[0] << 56;
				payloadLength |= dataBuffer[1] << 48;
				payloadLength |= dataBuffer[2] << 40;
				payloadLength |= dataBuffer[3] << 32;
				payloadLength |= dataBuffer[4] << 24;
				payloadLength |= dataBuffer[5] << 16;
				payloadLength |= dataBuffer[6] << 8;
				payloadLength |= dataBuffer[7];
				parseState = 3;
				dataBuffer = dataBuffer.slice(8);
			} else if (parseState === 3 && dataBuffer.length >= 4) {
				maskingKey = dataBuffer.slice(0, 4);
				parseState = 4;
				dataBuffer = dataBuffer.slice(4);
			}

			// Wait for payload data
			if (parseState === 4 && dataBuffer.length >= payloadLength) {

				// Reset state
				parseState = 0;

				// Keep the connection alive
				clearTimeout(keepAliveTimer);
				keepAliveTimer = setTimeout(function () {
					socket.write(pingData);
				}, 20000);

				// Check for non-control frame
				if (opcode < 3) {

					// Allocate buffer for payload data
					payloadData = new Buffer(payloadLength);

					// Unmasking payload data
					i = payloadLength;
					while (i--) {
						payloadData[i] = dataBuffer[i] ^ maskingKey[i % 4];
					}

					// Concatenate payload data to the message
					dataBuffer = dataBuffer.slice(payloadLength);
					message = Buffer.concat([message, payloadData]);

					// Check for last frame
					if (fin) {

						// Emit messages
						type = 'binary';
						if (opcode === 1) {
							message = message.toString();
							type = 'text';
						}
						if (opcode === 2 || config.raw) {
							connection.emit('message', {
								data: message,
								type: type
							});
						} else {
							try {
								message = JSON.parse(message);
								connection.emit(message.event, message.data);
							} catch (error) {
								console.log('simpleS: cannot parse incoming WebSocket message');
								console.log('message: ' + message);
								console.log(error.stack);
							}
						}
						message = new Buffer(0);
					} else if (message.length > config.length) {

						// Message too big
						this.end(closeData);
						return;
					}
				} else if (opcode === 8) {
					this.end(closeData);
				}
			}
		});

		// Update connection list on client disconnect
		socket.on('close', function () {
			var index = 0;
			while (wsHost.connections[index] !== connection) {
				index++;
			}
			wsHost.connections.splice(index, 1);
			connection.emit('close');
		});
	});

	// Set simpleS properties
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		cache: {
			value: {}
		},
		hosts: {
			value: {
				main: this
			}
		},
		server: {
			value: server
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Start the server on the provided port
	this.start(port);
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

// Create a new host and save it to the hosts object
simples.prototype.host = function (name) {
	'use strict';

	this.hosts[name] = new host(this, name);
	return this.hosts[name];
};

// Start simples server
simples.prototype.start = function (port, callback) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Set the server to listen the port
	function listen() {

		var i;

		// Start all existing hosts
		for (i in that.hosts) {
			that.hosts[i].open();
		}

		// Start listening the port
		that.server.listen(port, function () {
			that.server.emit('release', callback);
		});
	}

	// Start or restart the server
	function start() {
		that.busy = true;
		if (that.started) {
			that.server.close(listen);
		} else {
			that.started = true;
			utils.getSessions(that, listen);
		}
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
	'use strict';

	// Shortcut to this context
	var that = this;

	// Stop the server
	function stop() {

		var i;

		// Set status flags
		that.started = false;
		that.busy = true;

		// Close all existing hosts
		for (i in that.hosts) {
			that.hosts[i].close();
		}

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
	'use strict';
	return new simples(port, options);
};