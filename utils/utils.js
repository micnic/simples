var fs = require('fs');
var path = require('path');
var url = require('url');
var zlib = require('zlib');

var mime = require('./mime');
var requestInterface = require('../lib/request');
var responseInterface = require('../lib/response');

// Default callback for "Not Found"
function e404(request, response) {
	response.end('"' + request.url.path + '" Not Found');
}

// Default callback for "Method Not Allowed"
function e405(request, response) {
	response.end('"' + request.method + '" Method Not Allowed');
}

// Default callback for "Internal Server Error"
function e500(request, response) {
	response.end('"' + request.url.path + '" Internal Server Error');
}

// Returns the named parameters of an advanced route
function getNamedParams(route, url) {
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

// Returns the advanced route if found
function findAdvancedRoute(routes, url) {
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
exports.handleCache = function (server, path, stream) {
	'use strict';
	
	var cache = server.cache;
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
		fs.ReadStream(path).on('data', function (data) {
			cache[path] = Buffer.concat([cache[path], data]);
		})
	});

	// Stream the data to the cache and the response
	cache[path] = new Buffer(0);
	fs.ReadStream(path).on('data', function (data) {
		cache[path] = Buffer.concat([cache[path], data]);
		stream.write(data);
	}).on('end', function () {
		stream.end();
	});
};

// Handle for the HTTP(S) requests
exports.handleHTTPRequest = function (request, response) {
	'use strict';

	// Set the keep alive timeout of the socket to 5 seconds
	request.connection.setTimeout(5000);

	var that = this;

	var headers = request.headers;
	var hostname = headers.host;
	var index = hostname.indexOf(':');
	if (index > 0) {
		hostname = hostname.substring(0, index);
	}

	// Get the host
	var host;
	if (this.hosts[hostname] && this.hosts[hostname].started) {
		host = this.hosts[hostname];
	} else {
		host = this.hosts.main;
	}

	// CORS limitation
	if (headers.origin) {
		var origin = headers.origin;
		index = ~host.origins.indexOf(origin);
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		response.setHeader('Access-Control-Allow-Methods', 'GET,POST');

		// Check for accepted origins
		if (index || host.origins[0] === '*' && !index) {
			response.setHeader('Access-Control-Allow-Origin', origin);
		} else {
			response.setHeader('Access-Control-Allow-Origin', hostname);
		}
	}

	// Check for preflighted request
	if (request.method === 'OPTIONS') {
		response.end();
		return;
	}

	// Check for supported content encodings of the client
	var acceptEncoding = headers['accept-encoding'];
	var contentEncoding;
	if (acceptEncoding) {
		if (~acceptEncoding.indexOf('deflate')) {
			contentEncoding = 'Deflate';
		} else if (~acceptEncoding.indexOf('gzip')) {
			contentEncoding = 'Gzip';
		}
	}

	// Prepare the response stream with possible compression
	if (contentEncoding) {
		response.setHeader('Content-Encoding', contentEncoding);
		response.stream = zlib[contentEncoding]();
		response.stream.pipe(response);
	} else {
		response.stream = response;
	}

	// Routing requests
	var requestURL = url.parse(request.url).pathname.substr(1);
	var routes = host.routes;

	var get = request.method === 'GET' || request.method === 'HEAD';
	var post = request.method === 'POST';

	// Create the route interface
	var routeInterface = [
		new requestInterface(host, request, response),
		new responseInterface(host, request, response)
	];

	// Routing for parametrized urls and static files
	function advancedRouting() {
		var urlSlices = requestURL.split('/');

		// Search for an advanced route in all, get and post routes
		var found = findAdvancedRoute(routes.all.advanced, urlSlices);
		if (!found.route && get) {
			found = findAdvancedRoute(routes.get.advanced, urlSlices);
		} else if (!found.route && post) {
			found = findAdvancedRoute(routes.post.advanced, urlSlices);
		}

		// Apply callback if found one
		if (found.route) {
			routeInterface[0].params = found.params;
			found.route.callback.apply(host, routeInterface);
		} else if (get && (routes.serve.path || requestURL === 'simples/client.js')) {
			staticRouting();
		} else {
			response.statusCode = 404;
			routes.error[404].apply(host, routeInterface);
		}
	}

	// Route static files or their symbolic links
	function routeFiles(lastModified) {
		var extension = path.extname(requestURL).substr(1);
		var notModified = Number(headers['if-modified-since']) === lastModified;
		var code = 200;
		if (notModified) {
			code = 304;
		}
		response.writeHead(code, {
			'Content-Type': mime[extension] || mime['default'],
			'Last-Modified': lastModified
		});
		if (notModified) {
			response.end();
		} else {
			exports.handleCache(that, requestURL, response.stream);
		}
	}

	// Callback for stats of static path
	function statCallback(error, stats) {
		if (!error && (stats.isFile() || stats.isSymbolicLink())) {
			routeFiles(stats.mtime.valueOf());
		} else if (!error && routes.serve.callback && stats.isDirectory()) {
			routes.serve.callback.apply(host, routeInterface);
		} else {
			response.statusCode = 404;
			routes.error[404].apply(host, routeInterface);
		}
	}

	// Route static files and directories
	function staticRouting() {

		var referer = hostname;
		var isBanned = false;

		// Verify referer
		if (headers.referer && host.referers.length) {
			referer = url.parse(headers.referer).hostname;
			index = ~host.referers.indexOf(referer);
			isBanned = host.referers[0] === '*' && index || !index;
		}

		// Response with 404 code to banned referers
		if (hostname !== referer && isBanned) {
			response.statusCode = 404;
			routes.error[404].apply(host, routeInterface);
			return;
		}

		// Check for client api file request
		if (requestURL === 'simples/client.js') {
			requestURL = __dirname + '/client.js';
		} else {
			requestURL = path.join(routes.serve.path, requestURL);
		}

		// Verify the stats of the path
		fs.stat(requestURL, statCallback);
	}

	// All requests routing
	function routing() {
		if ((get || post) && routes.all.raw[requestURL]) {
			routes.all.raw[requestURL].apply(host, routeInterface);
		} else if (get && routes.get.raw[requestURL]) {
			routes.get.raw[requestURL].apply(host, routeInterface);
		} else if (post && routes.post.raw[requestURL]) {
			routes.post.raw[requestURL].apply(host, routeInterface);
		} else if (get || post) {
			advancedRouting();
		} else {
			response.statusCode = 405;
			response.setHeader('Allow', 'GET,HEAD,POST');
			routes.error[405].apply(host, routeInterface);
		}
	}

	// Handler for internal errors of the server
	function errorHandler(error) {
		console.log('simpleS: Internal Server Error > "' + request.url + '"');
		console.log(error.stack + '\n');
		response.statusCode = 500;
		try {
			routes.error[500].apply(host, routeInterface);
		} catch (error) {
			console.log('simpleS: can not apply route for error 500');
			console.log(error.stack + '\n');
			response.stream.destroy();
		}
	}

	// Start acting when the request ended
	request.on('end', function () {

		// Vulnerable code handling
		try {
			routing();
		} catch (error) {
			errorHandler(error);
		}
	});

	request.resume();
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