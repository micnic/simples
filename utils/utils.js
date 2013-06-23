'use strict';

var client,
	fs = require('fs'),
	mime = require('./mime'),
	path = require('path'),
	qs = require('querystring'),
	url = require('url'),
	zlib = require('zlib');

// Prepare client-side simples.js content
fs.stat(__dirname + '/simples.js', function (error, stats) {

	// Log error
	if (error) {
		console.log('\nsimpleS: can not check "simples.js" stats');
		console.log(error.stack + '\n');
		return;
	}

	// Read the file
	fs.readFile(__dirname + '/simples.js', function (error, content) {

		if (error) {
			console.log('\nsimpleS: can not read "simples.js" content');
			console.log(error.stack + '\n');
			return;
		}

		// Set up file components
		client = {
			stats: stats,
			content: content
		};
	});
});

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
	location = location.split('/');

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

function cacheAtom(object, directory, name) {
	var location = path.join(directory, name);

	// Check file and folder stats
	fs.stat(location, function (error, stats) {

		// Log error
		if (error) {
			console.log('\nsimpleS: can not check path "' + location + '" for caching');
			console.log(error.stack + '\n');
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
					console.log('\nsimpleS: can not read file "' + location + '" for caching');
					console.log(error.stack + '\n');
				}).on('readable', function () {
					object.files[name].content = Buffer.concat([object.files[name].content, this.read()]);
				});
			}

			// Create a file watcher
			fs.watchFile(location, function (current, previous) {
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
						console.log('\nsimpleS: can not read file "' + location + '" for caching');
						console.log(error.stack + '\n');
					}).on('readable', function () {
						object.files[name].content = Buffer.concat([object.files[name].content, this.read()]);
					});
				}
			});
		}
	});
}

// Check if the origin is accepted by the host (CORS)
exports.accepts = function (host, hostname, origin) {

	// Get the hostname from the origin
	origin = url.parse(origin).hostname || origin;

	// Check if the origin is accepted
	if (host.origins.indexOf(origin) >= 0) {
		return host.origins[0] !== '*' || origin === hostname;
	} else {
		return host.origins[0] === '*' || origin === hostname;
	}
};

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
	object.files = {};

	// Read the directory content
	fs.readdir(directory, function (error, files) {

		// Stop on error
		if (error) {
			console.log('\nsimpleS: can not read directory "' + directory + '" for caching');
			console.log(error.stack + '\n');
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

	var i,
		j;

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
			console.log('\nsimpleS: can not parse sessions file');
			console.log(error.message + '\n');
		}

		// If data was not parsed
		if (typeof data === 'string') {
			callback();
			return;
		}

		// Activate the sessions from the file
		for (i in instance.hosts) {
			instance.hosts[i].sessions = data[i];

			for (j in data[i]) {
				instance.hosts[i].timers[j] = setTimeout(function (host, index) {
					delete host.sessions[index];
					delete host.timers[index];
				}, 3600000, instance.hosts[i], j);
			}
		}

		// Continue to port listening
		callback();
	});
};

// Get the cookies and the session
exports.parseCookies = function (request) {
	var content,
		cookies = {},
		currentChar,
		index,
		name,
		session = '',
		value;

	// Populate cookies and session
	if (request.headers.cookie) {
		content = request.headers.cookie;
		index = 0;
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
				session = value;
			} else {
				cookies[name] = value;
			}
			index++;
		}
	}

	return {
		cookies: cookies,
		session: session
	}
};

// Get the languages accepted by the client
exports.parseLangs = function (request) {

	var content = request.headers['accept-language'],
		currentChar,
		index = 0,
		lang,
		langs = [],
		quality;

	// Return an empty array if no accept language header
	if (!request.headers['accept-language']) {
		return [];
	}

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

	langs = langs.sort(function (first, second) {
		return second.quality - first.quality;
	});

	index = langs.length;

	while (index--) {
		langs[index] = langs[index].lang;
	}

	return langs;
};

// Parse data sent via POST method
exports.parsePOST = function (request, connection) {
	if (request.method !== 'POST' || !request.headers['content-type']) {
		return;
	}
	var boundary,
		boundaryLength,
		content = request.headers['content-type'],
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
				console.log('\nsimpleS: cannot parse incoming WebSocket message');
				console.log(error.stack + '\n');
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
			console.log('\nsimpleS: WebSocket does not support extensions\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
		}

		// Check for unknown frame type
		if ((frame.opcode & 7) > 2) {
			console.log('\nsimpleS: unknown WebSocket frame type\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
		}

		// Control frames should be <= 125 bits and not be fragmented
		if (frame.opcode > 7 && (frame.length > 125 || !frame.fin)) {
			console.log('\nsimpleS: invalid WebSocket control frame\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
		}

		// Check for mask flag
		if (!(frame.data[1] & 128)) {
			console.log('\nsimpleS: unmasked frame received\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
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
		} else if (frame.opcode === 9) {
			console.log('\nsimpleS: ping frame received\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
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
			console.log('\nsimpleS: can not use 64bit payload length\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
		}

		// Limit payload length to 32bit (4GB)
		frame.length = frame.data.readUInt32BE(6);
		frame.index += 8;
		frame.state = 3;
	}

	// Wait for masking key
	if (frame.state === 3 && frame.data.length - frame.index >= 4) {

		// Check if message is not too big
		if (frame.length + frame.message.length > connection.config.length) {
			console.log('\nsimpleS: too big WebSocket message\n');
			connection.socket.end(new Buffer([136, 0]), socketDestroy);
			return;
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
		setImmediate(function () {
			exports.parseWS(connection, frame, frame.data);
		});
	}
};

// Remove the routes from the host
exports.removeRoutes = function (type, routes) {

	var defaultRoutes = utils.defaultRoutes();

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

	var accepted,
		found,
		get,
		headers,
		hostname,
		isBanned,
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
	headers = request.headers;
	hostname = headers.host.split(':')[0];
	post = request.method === 'POST';

	// Check for CORS requests
	if (headers.origin) {

		// Check if the origin is accepted
		if (exports.accepts(host, hostname, headers.origin)) {
			origin = headers.origin;
		} else {
			origin = connection.protocol + '://' + connection.host;
		}

		// Set CORS response headers
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST');
		response.setHeader('Access-Control-Allow-Origin', origin);

		// End the response
		if (!accepted || request.method === 'OPTIONS') {
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

		if (found) {
			connection.params = found.params;
			route = found.route.callback;
		}
	}

	if (!route && (get || post)) {

		if (get) {
			var file;
			if (requestURL === 'simples.js') {
				file = client;
			} else if (host.cache) {
				file = getCache(host.cache, requestURL);
			}
			if (file) {
				if (file.stats.isDirectory()) {
					route = routes.serve;
				} else {
					route = function (connection) {
						connection.type(path.extname(requestURL).substr(1));
						var mtime = file.stats.mtime.valueOf();
						connection.header('Last-Modified', mtime);
						if (Number(headers['if-modified-since']) === mtime) {
							response.statusCode = 304;
							connection.end();
						} else {
							response.statusCode = 200;
							connection.end(file.content);
						}
					};
				}
			}
		}

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
	try { // request, host, connection
		if (typeof route === 'string') {
			connection.render(route, {
				connection: connection
			});
		} else {
			route.call(host, connection);
		}
	} catch (error) {
		console.log('\nsimpleS: Internal Server Error');
		console.log(connection.url.href);
		console.log(error.stack + '\n');
		response.statusCode = 500;
		try {
			routes.error[500].call(host, connection);
		} catch (stop) {
			console.log('\nsimpleS: can not apply route for error 500');
			console.log(stop.stack + '\n');
		}
	}
};

// Get the sessions from the hosts and save them to file
exports.saveSessions = function (instance, callback) {

	// Sessions container
	var i,
		j,
		sessions = {};

	// Select and deactivate sessions
	for (i in instance.hosts) {
		for (j in instance.hosts[i].timers) {
			clearTimeout(instance.hosts[i].timers[j]);
		}
		instance.hosts[i].timers = {};
		sessions[i] = instance.hosts[i].sessions;
	}

	// Prepare sessions for writing on file
	sessions = JSON.stringify(sessions);

	// Write the sessions in the file
	fs.writeFile('.sessions', sessions, 'utf8', function (error) {
		
		// Release the server in all cases
		instance.server.emit('release', callback);

		// Log the error
		if (error) {
			console.log('\nsimpleS: can not write sessions to file\n');
			console.log(error.message + '\n');
			return;
		}

		// Lot the sessions file creation
		console.log('\nsimpleS: file with sessions created\n');
	});
};