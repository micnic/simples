'use strict';

var cache = require('simples/lib/cache'),
	domain = require('domain'),
	httpConnection = require('simples/lib/http/connection'),
	url = require('url'),
	utils = require('simples/utils/utils');

// HTTP namespace
var http = exports;

// Clear expired sessions from the host
http.clearSessions = function (host) {

	var now = Date.now();

	// Loop throught the session and find the expired sessions
	Object.keys(host.sessions).forEach(function (element) {
		if (host.sessions[element].expiration <= now) {
			delete host.sessions[element];
		}
	});
};

// Generate default config for hosts
http.defaultConfig = function () {

	return {
		compression: {
			enabled: true,
			options: null
		},
		limit: 1048576,
		origins: [],
		referers: [],
		session: {
			enabled: false,
			secret: '',
			timeout: 3600000
		}
	};
};

// Generate empty routes
http.defaultRoutes = function () {

	return {
		dynamic: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		error: {
			404: http.e404,
			405: http.e405,
			500: http.e500
		},
		fixed: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		serve: null
	};
};

// Default callback for "Not Found"
http.e404 = function (connection) {
	connection.end('"' + connection.url.path + '" Not Found');
};

// Default callback for "Method Not Allowed"
http.e405 = function (connection) {
	connection.end('"' + connection.method + '" Method Not Allowed');
};

// Default callback for "Internal Server Error"
http.e500 = function (connection) {
	connection.end('"' + connection.url.path + '" Internal Server Error');
};

// Returns the advanced route if found
http.getDynamicRoute = function (connection, routes, verb) {

	var location = connection.path.substr(1),
		index = 0,
		keys = Object.keys(routes[verb]),
		length = keys.length,
		result = null,
		route = null;

	// Search for a valid route
	while (!result && index < length) {

		// Select the current route
		route = routes[verb][keys[index]];

		// Check if the location matches the route pattern
		if (route.pattern.test(location)) {
			result = route.callback;
		}

		// Switch to "all" verb if no result found
		if (index === length - 1 && verb !== 'all' && !result) {
			index = 0;
			keys = Object.keys(routes.all);
			length = keys.length;
			verb = 'all';
		} else {
			index++;
		}
	}

	// Populat connection parameters if the route is found
	if (result) {
		location.match(route.pattern).slice(1).forEach(function (param, key) {
			connection.params[route.keys[key]] = param;
		});
	}

	return result;
};

// Relations between HTTP methods and REST verbs
http.methods = {
	'DELETE': 'del',
	'GET': 'get',
	'HEAD': 'get',
	'POST': 'post',
	'PUT': 'put'
};

// Check if the referer header is accepted by the host
http.refers = function (host, connection) {

	var headers = connection.request.headers,
		hostname = url.parse(headers.referer || '').hostname || '',
		referers = host.conf.referers,
		valid = true;

	// Check for referer
	if (headers.referer && hostname !== connection.host) {
		valid = false;
	}

	// Check if referer is found in the accepted referers list
	if (!valid && hostname && referers.length) {
		if (referers.indexOf(hostname) < 0) {
			valid = referers[0] === '*';
		} else {
			valid = referers[0] !== '*';
		}
	}

	return valid;
};

// Listener for HTTP requests
http.requestListener = function (host, request, response) {

	var config = host.conf,
		connection = new httpConnection(host, request, response);

	// Check if sessions are enabled
	if (config.session.enabled) {
		utils.getSession(host, connection, http.setSession);
	} else {
		http.requestProcess(connection);
	}
};

// Decide what to do with the request depending on its method
http.requestProcess = function (connection) {

	var host = connection.parent,
		request = connection.request;

	// Route the request and parse it if needed
	if (request.method === 'GET' || request.method === 'HEAD') {
		http.routing(host, connection);
	} else if (request.headers['content-length'] > host.conf.limit) {
		console.error('\nsimpleS: Request Entity Too Large\n');
		request.destroy();
	} else {
		http.requestParser(connection);
	}
};

// Populate connection body and files
http.requestParser = function (connection) {

	var host = connection.parent,
		length = 0,
		parser,
		parts = [],
		request = connection.request;

	// Split content type in two parts to get boundary if exists
	if (request.headers['content-type']) {
		parts = request.headers['content-type'].split(';');
	}

	// Choose the content parser
	if (parts[0] === 'application/x-www-form-urlencoded') {
		parser = new utils.parsers.qs();
	} else if (parts[0] === 'multipart/form-data' && parts.length > 1) {
		parser = new utils.parsers.multipart(parts[1].substr(10));
	} else if (parts[0] === 'application/json') {
		parser = new utils.parsers.json();
	}

	// If no parser was defined then make connection body a buffer
	if (!parser) {
		connection.body = new Buffer(0);
	}

	// Process received data
	request.on('readable', function () {

		var data = request.read() || new Buffer(0);

		// Get the read length
		length += data.length;

		// Check for request body limit and parse data
		if (length > host.conf.limit) {
			console.error('\nsimpleS: Request Entity Too Large\n');
			request.destroy();
		} else if (parser) {
			parser.parse(data.toString());
		} else {
			connection.body = utils.buffer(connection.body, data, length);
		}
	}).on('end', function () {

		// If parser is defined end parsing
		if (parser) {
			parser.parse(null);
			connection.body = parser.result;
		}

		http.routing(host, connection);
	});
};

// Routes all the requests
http.routing = function (host, connection) {

	var index = 0,
		length = host.middlewares.length,
		location = connection.path.substr(1),
		origin,
		request = connection.request,
		response = connection.response,
		route,
		routes = host.routes,
		verb = http.methods[request.method];

	// Get middlewares one by one and execute them
	function nextMiddleware(stop) {
		if (index < length && !stop) {
			setImmediate(host.middlewares[index], connection, nextMiddleware);
			index++;
		} else if (!stop) {

			// Check if any logger is defined and log data
			if (host.logger.callback) {
				utils.log(host, connection);
			}

			// Apply the selected route
			http.applyRoute(connection, route, verb);
		}
	}

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
		response.setHeader('Access-Control-Allow-Headers', 'True');
		response.setHeader('Access-Control-Allow-Methods', 'True');
		response.setHeader('Access-Control-Allow-Origin', origin);

		// End the response
		if (request.method === 'OPTIONS') {
			response.end();
			return;
		}
	}

	// Find the fixed and dynamic route
	if (verb) {
		if (routes.fixed[verb][location]) {
			route = routes.fixed[verb][location];
		} else if (routes.fixed.all[location]) {
			route = routes.fixed.all[location];
		} else {
			route = http.getDynamicRoute(connection, routes.dynamic, verb);
		}
	}

	// Wrap the connection inside a domain
	domain.create().on('error', function (error) {
		if (response.statusCode === 500) {
			console.error('\nsimpleS: Can not apply route for error 500');
			console.error(error.stack + '\n');
		} else {
			console.error('\nsimpleS: Internal Server Error');
			console.error(connection.url.href);
			console.error(error.stack + '\n');
			response.statusCode = 500;
			this.bind(routes.error[500]).call(host, connection);
		}
	}).run(nextMiddleware);
};

// Apply the selected route
http.applyRoute = function (connection, route, verb) {

	var element = null,
		host = connection.parent,
		location = connection.path.substr(1),
		routes = host.routes;

	// Get static content if found
	if (!route && verb === 'get' && http.refers(host, connection)) {

		// Check for client side API file serve
		if (location === 'simples.js') {
			element = cache.client;
		} else {
			element = host.cache.read(location);
		}
	}

	// Check for errors 404 and 405
	if (!verb) {
		connection.response.statusCode = 405;
		connection.response.setHeader('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	} else if (!element && !route) {
		connection.response.statusCode = 404;
		route = routes.error[404];
	}

	// Apply the route
	if (typeof route === 'string') {
		connection.render(route);
	} else if (element) {
		http.applyStaticRoute(connection, element);
	} else {
		route.call(host, connection);
	}
};

// Set the session cookies for HTTP requests
http.setSession = function (connection, sid, hash) {

	var config = connection.parent.conf,
		options = {};

	// Prepare cookies options
	options.expires = config.session.timeout;
	options.httpOnly = true;

	// Write the session cookies
	connection.cookie('_session', sid, options);
	connection.cookie('_hash', hash, options);

	// Continue to process the request
	http.requestProcess(connection);
};

// The route for static files
http.staticFileRoute = function (connection, file) {

	var mtime = file.stats.mtime.valueOf();

	// Set the last modified time and the content type of the response
	connection.header('Last-Modified', mtime);
	connection.type(file.location.substr(file.location.lastIndexOf('.') + 1));

	// Check if modification time coincides on the client and on the server
	if (Number(connection.request.headers['if-modified-since']) === mtime) {
		connection.response.statusCode = 304;
		connection.end();
	} else {
		connection.end(file.content);
	}
};

// Apply the routes for static files and directories
http.applyStaticRoute = function (connection, element) {

	var directory = null,
		host = connection.parent,
		routes = host.routes;

	// Check if the element is a directory or a file
	if (element.stats.isDirectory()) {

		// Prepare directory items
		directory = Object.keys(element.files).map(function (name) {

			var item = {};

			// Prepare item object
			item.name = name;
			item.stats = file.files[element].stats;

			return item;
		});

		// Apply the route for the directory
		routes.serve.call(host, connection, directory);
	} else {
		http.staticFileRoute.call(host, connection, element);
	}
};