var fs = require('fs'),
	mime = require('./mime'),
	path = require('path'),
	url = require('url'),
	zlib = require('zlib');

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

// Returns the named parameters of an advanced route
function getNamedParams(route, url) {
	'use strict';
	var index = route.length;
	var params = {};
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

// Add all kinds of routes
exports.addRoute = function (type, route, callback) {
	'use strict';

	// Add the route to the host
	if (type === 'serve') {
		this.routes.serve = {
			path: route,
			callback: callback
		};
	} else {
		if (route.charAt(0) === '/') {
			route = route.substr(1);
		}
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (~route.indexOf(':')) {
			this.routes[type].advanced.push({
				slices: route.split('/'),
				callback: callback
			});
		} else {
			this.routes[type].raw[route] = callback;
		}
	}
};

// Generate emptry routes
exports.defaultRoutes = function () {
	'use strict';

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
		serve: {}
	};
};

// Returns the advanced route if found
exports.findAdvancedRoute = function (routes, url) {
	'use strict';
	var index = routes.length;
	var params;
	while (!params && index--) {
		if (routes[index].slices.length === url.length) {
			params = getNamedParams(routes[index].slices, url);
		}
	}
	return {
		params: params,
		route: routes[index]
	};
};

// Returns a random session name
exports.generateSessionName = function () {
	var chars = [];
	var count = 16;
	var value;

	// Generate numbers in loop
	while (count--) {

		// Get a random value from 0 to 61
		value = Math.round(Math.random() * 61);

		// Prepare char code 0-9a-zA-Z
		value += value < 10 && 48 || value < 36 && 55 || 61;

		// Append the value to the chars array
		chars[chars.length] = value;
	}

	return String.fromCharCode.apply(null, chars);
}

// Get sessions from file and activate them in the hosts
exports.getSessions = function (server, callback) {
	'use strict';

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
			console.log('simpleS: can not parse sessions file');
			console.log(error.message + '\n');
		}

		// If data was not parsed
		if (typeof data === 'string') {
			callback();
			return;
		}

		// Activate the sessions from the file
		for (var i in server.hosts) {
			server.hosts[i].manageSessions(data[i]);
		}

		// Continue to port listening
		callback();
	});
};

// Handle for static files content cache
exports.handleCache = function (cache, path, stream) {
	'use strict';
	
	var index = 0;

	// Read 64kB pieces from cache
	function read() {
		if (cache[path].length - index > 65536) {
			stream.write(cache[path].slice(index, index += 65536));
			setImmediate(read);
		} else {
			stream.end(cache[path].slice(index));
		}
	}

	if (cache[path]) {
		read();
		return;
	}

	// Watch file changes for dynamic caching
	fs.watch(path, {
		persistent: false
	}, function (event, filename) {

		// Close the watcher and remove the cache on file rename/move/delete
		if (event === 'rename') {
			this.close();
			delete cache[path];
			return;
		}

		// Stream the data to the cache
		cache[path] = new Buffer(0);
		fs.ReadStream(path).on('readable', function () {
			cache[path] = Buffer.concat([cache[path], this.read()]);
		})
	});

	// Stream the data to the cache and the response
	cache[path] = new Buffer(0);
	fs.ReadStream(path).on('readable', function () {
		var data = this.read();
		cache[path] = Buffer.concat([cache[path], data]);
		stream.write(data);
	}).on('end', function () {
		stream.end();
	});
};

// Populate sessions from an object or return them
exports.manageSessions = function (sessions) {
	'use strict';

	function cleaner(index) {
		delete this.sessions[index];
	}

	if (sessions) {
		this.sessions = sessions;

		for (var i in this.sessions) {
			this.sessions[i]._timeout = setTimeout(cleaner, this.sessions[i]._timeout, i);
		}
	} else {
		var timeout;
		var start;
		var end;

		for (var i in this.sessions) {
			timeout = this.sessions[i]._timeout;
			start = new Date(timeout._idleStart).valueOf();
			end = new Date(start + timeout._idleTimeout).valueOf();
			clearTimeout(timeout);
			this.sessions[i]._timeout = end - new Date().valueOf();
		}

		return this.sessions;
	}
	
}

// Get the cookies and the session
exports.parseCookies = function (host, request) {
	var cookies = {};
	var session = null;

	// Populate cookies and session
	if (request.headers.cookie) {
		var content = request.headers.cookie;
		var currentChar;
		var index = 0;
		while (currentChar = content.charAt(index)) {
			while (currentChar = content.charAt(index), currentChar === ' ') {
				index++;
			}
			if (!currentChar) {
				break;
			}
			var name = '';
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
			var value = '';
			while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ';') {
				value += currentChar;
				index++;
			}
			value = decodeURIComponent(value);
			if (name === '_session') {
				session = host.sessions[value];
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

	// Return an empty array if no accept language header
	if (!request.headers['accept-language']) {
		return [];
	}

	var content = request.headers['accept-language'];
	var currentChar;
	var index = 0;
	var lang;
	var langs = [];
	var quality;
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

	var index = langs.length;

	while (index--) {
		langs[index] = langs[index].lang;
	}

	return langs;
};

// Parse data sent via POST method
exports.parsePOST = function (request, that) {
	'use strict';
	if (!request.headers['content-type']) {
		return;
	}
	var content = request.headers['content-type'];
	var index = 0;
	var currentChar;
	while (currentChar = content.charAt(index), currentChar === ' ') {
		index++;
	}
	if (!currentChar) {
		return;
	}
	var contentType = '';
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
		var boundary = '';
		while (currentChar = content.charAt(index)) {
			boundary += currentChar;
			index++;
		}
		if (!boundary) {
			return;
		}
		content = that.body;
		index = 0;
		var boundaryLength = boundary.length;
		var filename;
		var name;
		var type;
		var tempIndex;
		var filecontent;
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
				that.files[name] = {
					content: filecontent,
					filename: filename,
					type: type
				};
			} else {
				that.query[name] = filecontent;
			}
			index += 2;
		}
	} else {
		var POSTquery = qs.parse(that.body);
		for (var i in POSTquery) {
			that.query[i] = POSTquery[i];
		}
	}
}

// Get the sessions from the hosts and save them to file
exports.saveSessions = function (server, callback) {
	'use strict';

	// Sessions container
	var sessions = {};

	// Select and deactivate sessions
	for (var i in server.hosts) {
		sessions[i] = server.hosts[i].manageSessions();
	}

	// Prepare sessions for writing on file
	sessions = JSON.stringify(sessions);

	// Write the sessions in the file
	fs.writeFile('.sessions', sessions, 'utf8', function (error) {
		
		// Release the server in all cases
		server.emit('release', callback);

		// Log the error
		if (error) {
			console.log('simpleS: can not write sessions to file');
			console.log(error.message + '\n');
			return;
		}

		// Lot the sessions file creation
		console.log('simpleS: file with sessions created');
	});
};