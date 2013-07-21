'use strict';

var client,
	fs = require('fs'),
	path = require('path'),
	qs = require('querystring'),
	url = require('url');

// Prepare client-side simples.js content
fs.stat(__dirname + '/simples.js', function (error, stats) {

	// Log error
	if (error) {
		console.error('\nsimpleS: Can not find "simples.js"');
		console.error(error.stack + '\n');
		return;
	}

	// Read the file
	fs.readFile(__dirname + '/simples.js', function (error, content) {

		if (error) {
			console.error('\nsimpleS: Can not read "simples.js" content');
			console.error(error.stack + '\n');
			return;
		}

		// Set up file components
		client = {
			stats: stats,
			content: content
		};
	});
});

// Check if the origin header is accepted by the host (CORS)
function accepts(host, request) {

	var accepted = true,
		origin = request.headers.origin;

	// Get the hostname from the origin
	origin = url.parse(origin).hostname || origin;

	// Check if the origin is accepted
	if (origin !== request.headers.host.split(':')[0]) {
		if (host.conf.origins.indexOf(origin) < 0) {
			accepted = host.conf.origins[0] === '*' ;
		} else {
			accepted = host.conf.origins[0] !== '*';
		}
	}

	return accepted;
}

// Default callback for "Not Found"
function e404(connection) {
	connection.end('"' + connection.url.path + '" Not Found');
}

// Default callback for "Method Not Allowed"
function e405(connection) {
	connection.end('"' + connection.method + '" Method Not Allowed');
}

// Default callback for "Internal Server Error"
function e500(connection) {
	connection.end('"' + connection.url.path + '" Internal Server Error');
}

// Returns the advanced route if found
function findAdvancedRoute(routes, url) {
	var index,
		params;
	for (index in routes) {
		if (routes[index].slices.length === url.length) {
			params = getNamedParams(routes[index].slices, url);
			if (params) {
				return {
					params: params,
					route: routes[index]
				};
			}
		}
	}
	return null;
}

// Handle for static files content cache
function getCache(object, location) {

	// Get the location components
	location = location.split('/');

	// Get the content of the files
	for (var i = 0; i < location.length; i++) {
		if (object.files[location[i]]) {
			object = object.files[location[i]];
		} else {
			return null;
		}
	}

	return object;
}

// Returns the named parameters of an advanced route
function getNamedParams(route, url) {

	var index = route.length,
		params = {};

	// Populate parameters
	while (index--) {
		if (route[index].charAt(0) === ':') {
			params[route[index].substr(1)] = url[index];
		} else if (route[index] !== url[index]) {
			params = null;
			break;
		}
	}

	return params;
}

// Return the route to the static files
function getStaticRoute(host, location) {

	var file;

	// Callback for a static file route
	function staticRoute(connection) {
		var mtime = file.stats.mtime.valueOf();
		connection.header('Last-Modified', mtime);
		connection.type(path.extname(location).substr(1));

		// Check if modification time coincides on the client and the server
		if (Number(connection.request.headers['if-modified-since']) === mtime) {
			connection.response.statusCode = 304;
			connection.end();
		} else {
			connection.end(file.content);
		}
	};

	// Check for client-side script file
	if (location === 'simples.js') {
		file = client;
	} else if (host.cache) {
		file = getCache(host.cache, location);
	}

	// Return the route
	if (file) {
		if (file.stats.isDirectory()) {
			return host.routes.serve;
		}

		return staticRoute;
	}

	return null;
}

function cacheAtom(object, directory, name) {

	var location = path.join(directory, name);

	// Check file and folder stats
	fs.stat(location, function (error, stats) {

		// Log error
		if (error) {
			console.error('\nsimpleS: Can not check path "' + location + '" for caching');
			console.error(error.stack + '\n');
			return;
		}

		// Check if not in cache or is modified
		if (!object.files[name] || stats.mtime.valueOf() !== object.files[name].stats.mtime.valueOf()) {

			// Check the type of the element
			if (stats.isDirectory()) {
				object.files[name] = {
					files: {},
					stats: stats
				};
				exports.cache(object.files[name], location);
			} else {
				object.files[name] = {
					content: new Buffer(0),
					stats: stats
				};
				fs.ReadStream(location).on('error', function (error) {
					console.error('\nsimpleS: Can not read file "' + location + '" for caching');
					console.error(error.stack + '\n');
				}).on('readable', function () {
					object.files[name].content = Buffer.concat([object.files[name].content, this.read() || new Buffer(0)]);
				});
			}

			// Create a file watcher
			fs.watchFile(location, {
				persistent: false
			}, function (current, previous) {
				if (!current.nlink) {
					delete object.files[name];
					fs.unwatchFile(location);
				} else if (current.isDirectory()) {
					exports.cache(object.files[name], location);
				} else {
					object.files[name] = {
						content: new Buffer(0),
						stats: current
					};
					fs.ReadStream(location).on('error', function (error) {
						console.error('\nsimpleS: Can not read file "' + location + '" for caching');
						console.error(error.stack + '\n');
					}).on('readable', function () {
						object.files[name].content = Buffer.concat([object.files[name].content, this.read() || new Buffer(0)]);
					});
				}
			});
		}
	});
}

// Parse data sent via POST method
function parsePOST(connection) {

	var boundary,
		boundaryLength,
		content = connection.request.headers['content-type'],
		contentType,
		currentChar,
		filecontent,
		filename,
		index = 0,
		name,
		POSTquery,
		tempIndex,
		type;

	while (currentChar = content.charAt(index), currentChar === ' ') {
		index++;
	}
	if (!currentChar) {
		return;
	}
	contentType = '';
	while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ';') {
		contentType += currentChar;
		index++;
	}
	if (contentType === 'multipart/form-data') {
		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === ';') {
			index++;
		}
		if (!currentChar) {
			return;
		}
		var buffer = '';
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== '=') {
			buffer += currentChar;
			index++;
		}
		if (buffer !== 'boundary' || !currentChar) {
			return;
		}
		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === '=') {
			index++;
		}
		if (!currentChar) {
			return;
		}
		boundary = '';
		while (currentChar = content.charAt(index)) {
			boundary += currentChar;
			index++;
		}
		if (!boundary) {
			return;
		}
		content = connection.body;
		index = 0;
		boundaryLength = boundary.length;
		while (content.substr(index, 4 + boundaryLength) === '--' + boundary + '\r\n') {
			index += 4 + boundaryLength;
			index = content.indexOf('name="', index) + 6;
			if (index < 6) {
				break;
			}
			name = content.substring(index, content.indexOf('"', index));
			index += name.length + 1;
			tempIndex = content.indexOf('filename="', index) + 10;
			filename = undefined;
			if (tempIndex >= 10) {
				filename = content.substring(tempIndex, content.indexOf('"', tempIndex));
				index += 11 + filename.length;
				index = content.indexOf('Content-Type: ', index) + 14;
				type = content.substring(index, content.indexOf('\r', index));
				index += type.length;
			}
			index += 4;
			filecontent = '';
			while (currentChar = content.charAt(index), content.substr(index, 4 + boundaryLength) !== '\r\n--' + boundary) {
				filecontent += currentChar;
				index++;
			}
			if (filename) {
				connection.files[name] = {
					content: filecontent,
					filename: filename,
					type: type
				};
			} else {
				connection.query[name] = filecontent;
			}
			index += 2;
		}
	} else {
		POSTquery = qs.parse(connection.body);
		for (index in POSTquery) {
			connection.query[index] = POSTquery[index];
		}
	}
}

// Check if the referer header is accepted by the host
function refers(host, connection) {

	var accepted = true,
		referer,
		request = connection.request;

	if (request.headers.referer && host.conf.referers.length) {
		referer = url.parse(request.headers.referer).hostname;

		if (host.conf.referers.indexOf(referer) < 0) {
			accepted = host.conf.referers[0] === '*';
		} else {
			accepted = host.conf.referers[0] !== '*';
		}
	}

	return accepted || referer === connection.host;
}

// Add all kinds of routes
exports.addRoutes = function (type, routes, callback) {

	// Add the routes to the host
	if (Array.isArray(routes)) {
		for (var i = 0; i < routes.length; i++) {
			if (routes[i].charAt(0) === '/') {
				routes[i] = routes[i].substr(1);
			}
			routes[i] = url.parse(routes[i]).pathname || '';

			// Check for routes with named parameters
			if (~routes[i].indexOf(':')) {
				this.routes[type].advanced[routes[i]] = {
					slices: routes[i].split('/'),
					callback: callback
				};
			} else {
				this.routes[type].raw[routes[i]] = callback;
			}
		}
	} else if (typeof routes === 'string') {
		if (routes.charAt(0) === '/') {
			routes = routes.substr(1);
		}
		routes = url.parse(routes).pathname || '';

		// Check for routes with named parameters
		if (~routes.indexOf(':')) {
			this.routes[type].advanced[routes] = {
				slices: routes.split('/'),
				callback: callback
			};
		} else {
			this.routes[type].raw[routes] = callback;
		}
	}
};

// Populate object with directory content
exports.cache = function (object, directory) {

	// Prepare container for directory files
	object.files = {};

	// Read the directory content
	fs.readdir(directory, function (error, files) {

		// Stop on error
		if (error) {
			console.error('\nsimpleS: can not read directory "' + directory + '" for caching');
			console.error(error.stack + '\n');
			return;
		}
		var index = files.length;

		// Loop through all files
		while (index--) {
			cacheAtom(object, directory, files[index]);
		}
	});
};

// Generate empty routes
exports.defaultRoutes = function () {

	return {
		all: {
			advanced: [],
			raw: {}
		},
		error: {
			404: e404,
			405: e405,
			500: e500
		},
		get: {
			advanced: [],
			raw: {}
		},
		post: {
			advanced: [],
			raw: {}
		},
		serve: null
	};
};

// Return a random session name of 16 characters
exports.generateSessionName = function () {

	var chrs = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
		count = 16,
		name = '';

	// Append a random character to the name in loop
	while (count--) {
		name += chrs.charAt(Math.random() * 62 | 0);
	}

	return name;
};

// Get sessions from file and activate them in the hosts
exports.getSessions = function (instance, callback) {

	// Read and parse the sessions file
	fs.readFile('.sessions', 'utf8', function (error, data) {

		// Catch error at reading
		if (error) {
			callback();
			return;
		}

		// Supervise session file parsing
		try {
			data = JSON.parse(data);
		} catch (error) {
			console.error('\nsimpleS: can not parse sessions file');
			console.error(error.message + '\n');
		}

		// If data was not parsed
		if (typeof data === 'string') {
			callback();
			return;
		}

		// Activate the sessions from the file
		Object.keys(instance.hosts).forEach(function (host) {
			instance.hosts[host].sessions = data[host];

			Object.keys(data[host]).forEach(function (timer) {
				instance.hosts[host].timers[timer] = setTimeout(function () {
					delete instance.hosts[host].sessions[timer];
					delete instance.hosts[host].timers[timer];
				}, 3600000);
			});
		});

		// Continue to port listening
		callback();
	});
};

// Get the cookies and the session
exports.parseCookies = function (content) {

	var cookies = {},
		currentChar,
		index = 0,
		name,
		value;

	// Populate cookies and session
	while (currentChar = content.charAt(index)) {
		while (currentChar = content.charAt(index), currentChar === ' ') {
			index++;
		}
		if (!currentChar) {
			break;
		}
		name = '';
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== '=') {
			name += currentChar;
			index++;
		}
		if (!currentChar) {
			break;
		}
		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === '=') {
			index++;
		}
		if (!currentChar) {
			break;
		}
		value = '';
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ';') {
			value += currentChar;
			index++;
		}
		value = decodeURIComponent(value);
		if (name === '_session') {
			Object.defineProperty(cookies, '_session', {
				value: value
			});
		} else {
			cookies[name] = value;
		}
		index++;
	}

	return cookies;
};

// Get the languages accepted by the client
exports.parseLangs = function (content) {

	var currentChar,
		index = 0,
		lang,
		langs = [],
		quality;

	// Start parsing
	while (currentChar = content.charAt(index)) {
		lang = '';
		quality = '';
		while (currentChar = content.charAt(index), currentChar === ' ') {
			index++;
		}
		if (!currentChar) {
			break;
		}
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ',' && currentChar !== ';') {
			lang += currentChar;
			index++;
		}
		index++;
		if (!currentChar || currentChar === ',') {
			langs.push({
				lang: lang,
				quality: 1
			});
			continue;
		}
		while (currentChar = content.charAt(index), currentChar === ' ') {
			index++;
		}
		if (currentChar !== 'q') {
			break;
		}
		index++;
		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === '=') {
			index++;
		}
		if (!currentChar) {
			break;
		}
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ',') {
			quality += currentChar;
			index++;
		}
		langs.push({
			lang: lang,
			quality: Number(quality)
		});
		index++;
	}

	// Sort the languages in the order of their importance and return them
	return langs.sort(function (first, second) {
		return second.quality - first.quality;
	}).map(function (element) {
		return element.lang;
	});
};

// Parse data received via WebSocket
exports.parseWS = function (connection, frame, data) {

	var i;

	// Destroy the TCP socket
	function socketDestroy() {
		connection.socket.destroy();
	}

	// Prepare message
	function parseMessage() {

		// Emit messages
		if (frame.opcode === 1) {
			frame.message = frame.message.toString();
		}
		if (frame.opcode === 2 || connection.config.raw) {
			connection.emit('message', {
				data: frame.message,
				type: frame.opcode === 1 && 'text' || 'binary'
			});
		} else {
			try {
				frame.message = JSON.parse(frame.message);
				connection.emit(frame.message.event, frame.message.data);
			} catch (error) {
				console.error('\nsimpleS: cannot parse incoming WebSocket message');
				console.error(error.stack + '\n');
			}
		}
	}

	// Concatenate frame data with the received data
	frame.data = Buffer.concat([frame.data, data || new Buffer(0)]);

	// Wait for header
	if (frame.state === 0 && frame.data.length >= 2) {

		// Header components
		frame.fin = frame.data[0] & 128;
		frame.opcode = frame.data[0] & 15;
		frame.length = frame.data[1] & 127;

		// Check for extensions (reserved bits)
		if (frame.data[0] & 112) {
			console.error('\nsimpleS: WebSocket does not support extensions\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Check for unknown frame type
		if ((frame.opcode & 7) > 2) {
			console.error('\nsimpleS: Unknown WebSocket frame type\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Control frames should be <= 125 bits and not be fragmented
		if (frame.opcode > 7 && (frame.length > 125 || !frame.fin)) {
			console.error('\nsimpleS: Invalid WebSocket control frame\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Check for mask flag
		if (!(frame.data[1] & 128)) {
			console.error('\nsimpleS: Unmasked frame received\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Extend payload length or wait for masking key
		if (frame.length === 126) {
			frame.state = 1;
		} else if (frame.length === 127) {
			frame.state = 2;
		} else {
			frame.state = 3;
		}

		// Throw away header
		if (frame.opcode === 8) {
			connection.socket.end(new Buffer([136, 0]));
			frame.state = -1;
		} else if (frame.opcode === 9) {
			console.error('\nsimpleS: Ping frame received\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		} else if (frame.opcode === 10) {
			connection.keep();
			frame.data = frame.data.slice(6 + frame.length);
			frame.state = 0;
		} else {
			frame.index = 2;
		}
	}

	// Wait for 16bit, 64bit payload length
	if (frame.state === 1 && frame.data.length >= 4) {
		frame.length = frame.data.readUInt16BE(2);
		frame.index += 2;
		frame.state = 3;
	} else if (frame.state === 2 && frame.data.length >= 10) {

		// Don't accept payload length bigger than 32bit
		if (frame.data.readUInt32BE(2)) {
			console.error('\nsimpleS: Can not use 64bit payload length\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		// Limit payload length to 32bit (4GB)
		frame.length = frame.data.readUInt32BE(6);
		frame.index += 8;
		frame.state = 3;
	}

	// Wait for masking key
	if (frame.state === 3 && frame.data.length - frame.index >= 4) {

		// Check if message is not too big
		if (frame.length + frame.message.length > connection.config.limit) {
			console.error('\nsimpleS: Too big WebSocket message\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			frame.state = -1;
		}

		frame.mask = frame.data.slice(frame.index, frame.index + 4);
		frame.data = frame.data.slice(frame.index + 4);
		frame.index = 0;
		frame.state = 4;
	}

	// Wait for payload data
	if (frame.state === 4 && frame.data.length >= frame.length) {

		// Keep the connection alive
		connection.keep();

		i = frame.length;

		// Loop through bytes and apply the masking key
		while (i--) {
			frame.data[i] = frame.data[i] ^ frame.mask[i % 4];
		}

		// Concatenate payload data to the message
		frame.message = Buffer.concat([
			frame.message,
			frame.data.slice(0, frame.length)
		]);
		frame.data = frame.data.slice(frame.length);

		// Check for last frame and parse message
		if (frame.fin) {
			parseMessage();

			// Reset frame data
			frame.message = new Buffer(0);
			frame.state = 0;
		}
	}

	// Continue parsing if more data available
	if (frame.state === 0 && frame.data.length >= 2) {
		setImmediate(exports.parseWS, connection, frame, frame.data);
	}
};

// Remove the routes from the host
exports.removeRoutes = function (type, routes) {

	var defaultRoutes = exports.defaultRoutes();

	// Check what to remove
	if (routes) {

		if (Array.isArray(routes)) {
			for (var i = 0; i < routes.length; i++) {

				// Remove root and get pathname
				if (routes[i].charAt(0) === '/') {
					routes[i] = routes[i].substr(1);
				}
				routes[i] = url.parse(routes[i]).pathname || '';

				// Check for advanced routes
				if (~routes[i].indexOf(':')) {
					delete this.routes[type].advanced[routes[i]];
				} else {
					if (type === 'error') {
						this.routes.error[routes[i]] = defaultRoutes.error[routes[i]];
					} else {
						delete this.routes[type].raw[routes[i]];
					}
				}
			}
		} else if (typeof routes === 'string') {

			// Remove root and get pathname
			if (routes.charAt(0) === '/') {
				routes = routes.substr(1);
			}
			routes = url.parse(routes).pathname || '';

			// Check for advanced routes
			if (~routes.indexOf(':')) {
				delete this.routes[type].advanced[routes];
			} else {
				if (type === 'error') {
					this.routes.error[routes] = defaultRoutes.error[routes];
				} else {
					delete this.routes[type].raw[routes];
				}
			}
		}
	} else if (type) {
		this.routes[type] = defaultRoutes[type];
	} else {
		this.routes = defaultRoutes;
	}
};

// Routes all the requests
exports.routing = function (host, connection) {

	var found,
		get,
		post,
		origin,
		referer,
		request = connection.request,
		requestURL = connection.path.substr(1),
		response = connection.response,
		route,
		routes = host.routes,
		urlSlices;

	get = request.method === 'GET' || request.method === 'HEAD';
	post = request.method === 'POST';

	// Populate the files and the query of POST requests
	if (post && request.headers['content-type']) {
		parsePOST(connection);
	}

	// Check for CORS requests
	if (request.headers.origin) {

		// Check if the origin is accepted
		if (accepts(host, request)) {
			origin = request.headers.origin;
		} else {
			origin = connection.protocol + '://' + connection.host;
		}

		// Set CORS response headers
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST');
		response.setHeader('Access-Control-Allow-Origin', origin);

		// End the response
		if (request.method === 'OPTIONS') {
			response.end();
			return;
		}
	}

	// Choose the route
	if ((get || post) && routes.all.raw[requestURL]) {
		route = routes.all.raw[requestURL];
	} else if (get && routes.get.raw[requestURL]) {
		route = routes.get.raw[requestURL];
	} else if (post && routes.post.raw[requestURL]) {
		route = routes.post.raw[requestURL];
	} else if (get || post) {
		urlSlices = requestURL.split('/');
		found = findAdvancedRoute(routes.all.advanced, urlSlices);

		// Search for an advanced route in get and post routes
		if (!found && get) {
			found = findAdvancedRoute(routes.get.advanced, urlSlices);
		} else if (!found && post) {
			found = findAdvancedRoute(routes.post.advanced, urlSlices);
		}

		// Populate the connection parameters and use the selected route
		if (found) {
			connection.params = found.params;
			route = found.route.callback;
		}
	}

	// Check for an allowed HTTP method
	if (!route && (get || post)) {

		// Check for requests for static files
		if (get && refers(host, connection)) {
			route = getStaticRoute(host, requestURL);
		}

		// Check for an existent route
		if (!route) {
			response.statusCode = 404;
			route = routes.error[404];
		}
	} else if (!route) {
		response.statusCode = 405;
		response.setHeader('Allow', 'GET,HEAD,POST');
		route = routes.error[405];
	}

	// Vulnerable code handling
	try {
		if (typeof route === 'string') {
			connection.render(route);
		} else {
			route.call(host, connection);
		}
	} catch (error) {
		console.error('\nsimpleS: Internal Server Error');
		console.error(connection.url.href);
		console.error(error.stack + '\n');
		response.statusCode = 500;
		try {
			routes.error[500].call(host, connection);
		} catch (stop) {
			console.error('\nsimpleS: Can not apply route for error 500');
			console.error(stop.stack + '\n');
		}
	}
};

// Get the sessions from the hosts and save them to file
exports.saveSessions = function (instance, callback) {

	// Sessions container
	var sessions = {};

	// Select and deactivate sessions
	Object.keys(instance.hosts).forEach(function (host) {
		Object.keys(instance.hosts[host].timers).forEach(function (timer) {
			clearTimeout(instance.hosts[host].timers[timer]);
		});
		instance.hosts[host].timers = {};
		sessions[host] = instance.hosts[host].sessions;
	});

	// Prepare sessions for writing on file
	sessions = JSON.stringify(sessions);

	// Write the sessions in the file
	fs.writeFile('.sessions', sessions, 'utf8', function (error) {
		
		// Release the server in all cases
		instance.server.emit('release', callback);

		// Log the error
		if (error) {
			console.error('\nsimpleS: Can not write sessions to file\n');
			console.error(error.message + '\n');
			return;
		}

		// Lot the sessions file creation
		console.log('\nsimpleS: File with sessions created\n');
	});
};

// Check for a valide WebSocket handshake
exports.validateWS = function (host, wsHost, request) {

	var error;

	// Check for WebSocket host
	if (!wsHost || !wsHost.active) {
		error = '\nsimpleS: Request to an inactive WebSocket host\n';
	}

	// Check for valid upgrade header
	if (request.headers.upgrade !== 'websocket') {
		error = '\nsimpleS: Unsupported WebSocket upgrade header\n';
	}

	// Check for WebSocket handshake key
	if (!request.headers['sec-websocket-key']) {
		error = '\nsimpleS: No WebSocket handshake key\n';
	}

	// Check for WebSocket subprotocols
	if (!request.headers['sec-websocket-protocol']) {
		error = '\nsimpleS: No WebSocket subprotocols\n';
	}

	// Check for valid WebSocket protocol version
	if (request.headers['sec-websocket-version'] !== '13') {
		error = '\nsimpleS: Unsupported WebSocket version\n';
	}

	// Check for accepted origin
	if (request.headers.origin && !accepts(host, request)) {
		error = '\nsimpleS: WebSocket origin not accepted\n';
	}

	return error;
};