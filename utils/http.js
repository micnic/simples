'use strict';

var cache = require('./cache'),
	domain = require('domain'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	httpConnection = require('../lib/http/connection'),
	parsers = require('./parsers'),
	stream = require('stream'),
	url = require('url'),
	utils = require('./utils');

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

// Add listeners to the server
function httpAddListeners(server) {
	server.on('error', function (error) {
		this.parent.busy = false;
		this.parent.started = false;
		throw new Error('simpleS: Server error > ' + error.message);
	}).on('release', function (callback) {
		this.parent.busy = false;

		// Call the callback when the server is free
		if (callback) {
			callback.call(this.parent);
		}
	}).on('upgrade', utils.ws.wsRequestListener);
}

// Check if the referer header is accepted by the host
function refers(host, connection) {

	var accepted = true,
		referer,
		request = connection.request;

	if (request.headers.referer && host.conf.acceptedReferers.length) {
		referer = url.parse(request.headers.referer).hostname;

		if (host.conf.acceptedReferers.indexOf(referer) < 0) {
			accepted = host.conf.acceptedReferers[0] === '*';
		} else {
			accepted = host.conf.acceptedReferers[0] !== '*';
		}
	}

	return accepted || referer === connection.host;
}

// Returns the advanced route if found
function findAdvancedRoute(routes, location) {

	var param,
		params = {},
		route,
		value;

	['all', 'del', 'get', 'post', 'put'].some(function (verb) {
		return Object.keys(routes[verb].advanced).some(function (element) {
			var locationIndex = 0,
				routeIndex = 0;

			while (element.charAt(routeIndex)) {
				if (element.charAt(routeIndex) === location.charAt(locationIndex)) {
					routeIndex++;
					locationIndex++;
				} else if (element.charAt(routeIndex) === ':') {
					param = '';
					value = '';
					routeIndex++;

					while (element.charAt(routeIndex) && element.charAt(routeIndex) !== '/') {
						param += element.charAt(routeIndex);
						routeIndex++;
					}

					while (location.charAt(locationIndex) && location.charAt(locationIndex) !== '/') {
						value += location.charAt(locationIndex);
						locationIndex++;
					}

					params[param] = value;

					if (routeIndex === element.length) {
						route = routes[verb].advanced[element];
					}
				} else {
					params = {};
					route = null;
					break;
				}
			}

			return route;
		});
	});

	return {
		params: params,
		route: route
	};
}

// Routes all the requests
function routing(host, connection) {

	var del,
		file,
		found,
		get,
		post,
		put,
		origin,
		request = connection.request,
		requestURL = connection.path.substr(1),
		response = connection.response,
		route,
		routes = host.routes;

	// Route HTTP Server Error
	function routeServerError() {
		routes.error[500].call(host, connection);
	}

	// Callback for a static file route
	function staticRoute(connection) {

		var mtime = file.stats.mtime.valueOf();

		// Set the last modified time and the content type of the response
		connection.header('Last-Modified', mtime);
		connection.type(requestURL.substr(requestURL.lastIndexOf('.') + 1));

		// Check if modification time coincides on the client and on the server
		if (Number(connection.request.headers['if-modified-since']) === mtime) {
			connection.response.statusCode = 304;
			connection.end();
		} else {
			connection.end(file.content);
		}
	}

	// Cache the methods
	del = request.method === 'DELETE';
	get = request.method === 'GET' || request.method === 'HEAD';
	post = request.method === 'POST';
	put = request.method === 'PUT';

	// Check for CORS requests
	if (request.headers.origin) {

		// Check if the origin is accepted
		if (utils.accepts(host, request)) {
			origin = request.headers.origin;
		} else {
			origin = connection.protocol + '://' + connection.host;
		}

		// Set CORS response headers
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		response.setHeader('Access-Control-Allow-Methods', 'DELETE,GET,HEAD,POST,PUT');
		response.setHeader('Access-Control-Allow-Origin', origin);

		// End the response
		if (request.method === 'OPTIONS') {
			response.end();
			return;
		}
	}

	// Find the route
	if ((del || get || post || put) && routes.all.simple[requestURL]) {
		route = routes.all.simple[requestURL];
	} else if (del && routes.del.simple[requestURL]) {
		route = routes.del.simple[requestURL];
	} else if (get && routes.get.simple[requestURL]) {
		route = routes.get.simple[requestURL];
	} else if (post && routes.post.simple[requestURL]) {
		route = routes.post.simple[requestURL];
	} else if (put && routes.put.simple[requestURL]) {
		route = routes.out.simple[requestURL];
	} else if (del || get || post || put) {

		// Find the advanced route
		found = findAdvancedRoute(routes, requestURL);

		// Populate the connection parameters and use the selected route
		if (found.route) {
			connection.params = found.params;
			route = found.route;
		}

		// Check for static files routes
		if (!route && get && refers(host, connection)) {

			// Get cached files
			file = host.cache.read(requestURL);

			// Return the route
			if (file && file.stats.isDirectory()) {
				route = host.routes.serve;
			} else if (file) {
				route = staticRoute;
			} else {
				response.statusCode = 404;
				route = routes.error[404];
			}
		} else if (!route) {
			response.statusCode = 404;
			route = routes.error[404];
		}
	} else {
		response.statusCode = 405;
		response.setHeader('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	}

	// Wrap the connection inside a domain
	domain.create().on('error', function (error) {
		if (response.statusCode === 500) {
			console.error('\nsimpleS: Can not apply route for error 500');
			console.error(error.stack + '\n');
		} else {
			console.error('\nsimpleS: Internal Server Error > ' + connection.url.href);
			console.error(error.stack + '\n');
			response.statusCode = 500;
			this.run(routeServerError);
		}
	}).run(function () {

		// Check if any logger is defined and log data
		if (host.logger.callback) {
			utils.log(host, connection);
		}

		// Use the routes
		if (typeof route === 'string') {
			connection.render(route);
		} else {
			if (file && file.stats.isDirectory()) {
				route.call(host, connection, Object.keys(file.files).map(function (element) {
					return {
						name: element,
						stats: file.files[element].stats
					};
				}));
			} else {
				route.call(host, connection);
			}
		}
	});
}

// HTTP request listener
function httpRequestListener(request, response) {

	var connection,
		host;

	// Listener for request end event
	function onEnd() {
		routing(host, connection);
	}

	// Listener for request readable event
	function onReadable() {

		// Check for request body limit
		/*if (connection.body.length > host.conf.requestLimit) {
			console.error('\nsimpleS: Request Entity Too Large\n');
			request.destroy();
		}*/
	}

	// Check if host is provided by the host header
	if (request.headers.host) {
		host = this.parent.hosts[request.headers.host.split(':')[0]];
	}

	// Get the main host if the other one does not exist
	if (!host) {
		host = this.parent.hosts.main;
	}

	// Create the HTTP connection
	connection = new httpConnection(host, request, response);

	// Set the keep alive timeout of the request socket to 5 seconds
	request.connection.setTimeout(5000);

	// Set the default content type to HTML and charset UTF-8
	response.setHeader('Content-Type', 'text/html;charset=utf-8');

	// Route the request and parse it if needed
	if (request.method === 'GET' || request.method === 'HEAD') {
		routing(host, connection);
	} else {

		// Listen for incoming data
		if ((request.headers['content-length'] | 0) > host.conf.requestLimit) {
			console.error('\nsimpleS: Request Entity Too Large\n');
			request.destroy();
		} else {
			parsers.parse(connection);
			request.on('readable', onReadable).on('end', onEnd);
		}
	}
}

// Read the provide files an return the files object in the callback
function readFiles(files, callback) {

	var count = 0;

	// Check if files are read
	function onEnd() {
		count--;

		// If all files are read provide the files to the callback
		if (count === 0) {
			callback(files);
		}
	}

	// Loop through the files object
	Object.keys(files).filter(function (element) {
		return ['cert', 'key', 'pfx'].indexOf(element) >= 0;
	}).forEach(function (element) {

		var data,
			length,
			location = files[element];

		// Increase the count of the files
		count++;

		// Prepare the buffer
		files[element] = new Buffer(0);

		// Create the readable stream
		fs.ReadStream(location).on('error', function () {
			throw new Error('simpleS: Can not read "' + location + '"');
		}).on('readable', function () {
			data = this.read() || new Buffer(0);
			length = files[element].length + data.length;
			files[element] = utils.buffer(files[element], data, length);
		}).on('end', onEnd);
	});
}

// Generate empty routes
exports.httpDefaultRoutes = function () {

	return {
		all: {
			advanced: [],
			simple: {}
		},
		del: {
			advanced: [],
			simple: {}
		},
		error: {
			404: e404,
			405: e405,
			500: e500
		},
		get: {
			advanced: [],
			simple: {}
		},
		post: {
			advanced: [],
			simple: {}
		},
		put: {
			advanced: [],
			simple: {}
		},
		serve: null
	};
};

// Create the HTTP or the HTTPS server
exports.createServer = function (options, callback) {

	var server;

	// Create the HTTPS server
	function httpsServer(options) {

		// Prepare the HTTP and the HTTPS servers
		var aux = http.Server(httpRequestListener);
		server = https.Server(options, httpRequestListener);

		// Catch the errors in the auxiliary HTTP server
		aux.on('error', function (error) {
			server.emit('error', error);
		}).on('upgrade', utils.ws.wsRequestListener);

		// Manage the HTTP server depending on HTTPS events
		server.on('open', function () {
			aux.listen(80);
		}).on('close', function () {
			aux.close();
		});

		// Add the listeners for the server
		httpAddListeners(server);

		// Send the server object through the callback
		callback(server, true);
	}

	// Check the options and read the files for the HTTPS server
	if (options && (options.cert && options.key || options.pfx)) {
		readFiles(options, httpsServer);
	} else if (!options) {
		server = http.Server(httpRequestListener);
		httpAddListeners(server);
		callback(server, false);
	} else {
		throw new Error('simpleS: Invalid data for the HTTPS server');
	}
};