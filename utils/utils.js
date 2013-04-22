var fs = require('fs'),
	mime = require('./mime'),
	path = require('path'),
	url = require('url'),
	zlib = require('zlib');

// Default callback for "Not Found"
function e404(connection) {
	'use strict';
	connection.end('"' + connection.url.path + '" Not Found');
}

// Default callback for "Method Not Allowed"
function e405(connection) {
	'use strict';
	connection.end('"' + connection.method + '" Method Not Allowed');
}

// Default callback for "Internal Server Error"
function e500(connection) {
	'use strict';
	connection.end('"' + connection.url.path + '" Internal Server Error');
}

// Returns the named parameters of an advanced route
function getNamedParams(route, url) {
	'use strict';
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
			this.routes[type].advanced[route] = {
				slices: route.split('/'),
				callback: callback
			};
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
};

// Return a random session name of 16 characters
exports.generateSessionName = function () {
	'use strict';
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
	'use strict';

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
			console.log('simpleS: can not parse sessions file');
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
		});
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

// Get the cookies and the session
exports.parseCookies = function (request) {
	'use strict';
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
	'use strict';

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
exports.parsePOST = function (request, that) {
	'use strict';
	if (!request.headers['content-type']) {
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
		content = that.body;
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
		POSTquery = qs.parse(that.body);
		for (index in POSTquery) {
			that.query[index] = POSTquery[index];
		}
	}
}

// Get the sessions from the hosts and save them to file
exports.saveSessions = function (instance, callback) {
	'use strict';

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
			console.log('simpleS: can not write sessions to file');
			console.log(error.message + '\n');
			return;
		}

		// Lot the sessions file creation
		console.log('simpleS: file with sessions created');
	});
};