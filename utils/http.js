'use strict';

var domain = require('domain'),
	fs = require('fs'),
	path = require('path'),
	store = require('simples/lib/store'),
	utils = require('simples/utils/utils');

// HTTP namespace
var http = exports;

// Client file object
http.client = {};

// Prepare client file data
try {
	http.client.location = path.join(__dirname, './client.js');
	http.client.stats = fs.statSync(http.client.location);
	http.client.content = fs.readFileSync(http.client.location);
} catch (error) {
	console.error('\nCan not prepare simpleS client file');
	console.error(error.stack + '\n');
}

// Link to the HTTP connection prototype constructor
http.connection = require('simples/lib/http/connection');

// Link to the HTTP form prototype constructor
http.form = require('simples/lib/http/form');

// Relations between HTTP methods and used REST verbs
http.verbs = {
	DELETE: 'del',
	GET: 'get',
	HEAD: 'get',
	POST: 'post',
	PUT: 'put'
};

// Manage the behavior of the route
http.applyRoute = function (connection, route) {
	if (typeof route === 'function') {
		route.call(connection.parent, connection);
	} else if (typeof route === 'string') {
		connection.render(route);
	}
};

// Listener for HTTP requests
http.connectionListener = function (host, request, response) {

	var config = host.options,
		connection = new http.connection(host, request, response),
		failed = false,
		index = 0,
		length = host.middlewares.length,
		location = connection.path.substr(1),
		route = null,
		routes = host.routes,
		verb = http.verbs[connection.method];

	// Apply middlewares one by one and then apply the route
	function applyMiddlewares(stop) {
		if (index < length && !stop) {
			setImmediate(host.middlewares[index], connection, applyMiddlewares);
			index++;
		} else if (connection.method === 'OPTIONS') {
			connection.status(204).end();
		} else if (!stop) {
			if (config.session.enabled) {
				http.setSession(connection, function () {
					http.applyRoute(connection, route);
				});
			} else if (route) {
				http.applyRoute(connection, route);
			}
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
	} else {
		connection.status(405).header('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	}

	// Get static content if found
	if (!route && verb === 'get') {
		route = http.getStaticRoute(host, connection, location);
	}

	// Check for error 404
	if (!route) {
		connection.status(404);
		route = routes.error[404];
	}

	// Set the default keep alive timeout to 5 seconds
	connection.keep(5000);

	// Process the connection inside a domain
	domain.create().on('error', function (error) {

		// Emit safely the error to the host
		utils.emitError(host, error, true);

		// Try to apply the route for error 500 or destroy the connection
		if (!connection.started && !failed) {
			failed = true;
			connection.status(500);
			this.bind(routes.error[500]).call(host, connection);
		} else {
			connection.destroy();
		}
	}).run(applyMiddlewares);
};

// Create a render listener as a shortcut
http.createRenderListener = function (view, importer) {
	return function (connection) {
		connection.render(view, importer);
	};
};

// Generate default config for HTTP hosts
http.defaultConfig = function () {

	return {
		compression: {
			enabled: false,
			filter: /^.+$/i,
			options: null, // http://nodejs.org/api/zlib.html#zlib_options
			preferred: 'deflate' // can be 'deflate' or 'gzip'
		},
		cors: {
			credentials: false,
			headers: [],
			methods: ['DELETE', 'GET', 'HEAD', 'POST', 'PUT'],
			origins: []
		},
		session: {
			enabled: false,
			store: new store()
		}
	};
};

// Generate empty containers for routes
http.defaultRoutes = function () {

	// Default callback for "Not Found"
	function notFound(connection) {
		connection.end('"' + connection.url.path + '" Not Found');
	}

	// Default callback for "Method Not Allowed"
	function methodNotAllowed(connection) {
		connection.end('"' + connection.method + '" Method Not Allowed');
	}

	// Default callback for "Internal Server Error"
	function internalServerError(connection) {
		connection.end('"' + connection.url.path + '" Internal Server Error');
	}

	return {
		dynamic: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		error: {
			404: notFound,
			405: methodNotAllowed,
			500: internalServerError
		},
		fixed: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		serve: null,
		ws: {}
	};
};

// Returns the dynamic route if found
http.getDynamicRoute = function (connection, routes, verb) {

	var location = connection.path.substr(1),
		index = 0,
		keys = Object.keys(routes[verb]),
		length = keys.length,
		listener = null,
		route = null;

	// Search for the dynamic route in the verb's routes
	while (!listener && index < length) {

		// Select the current route
		route = routes[verb][keys[index]];

		// Check if the location matches the route pattern
		if (route.pattern.test(location)) {
			listener = route.listener;
		}

		// Get the next index
		index++;
	}

	// Check if the listener was not found to switch to "all" verb
	if (!listener) {

		// Reset index, keys and the length
		index = 0;
		keys = Object.keys(routes.all);
		length = keys.length;

		// Search for the dynamic route in "all" verb's routes
		while (!listener && index < length) {

			// Select the current route
			route = routes.all[keys[index]];

			// Check if the location matches the route pattern
			if (route.pattern.test(location)) {
				listener = route.listener;
			}

			// Get the next index
			index++;
		}
	}

	// Populate connection parameters if the route is found
	if (listener) {
		location.match(route.pattern).slice(1).forEach(function (param, key) {
			connection.params[route.keys[key]] = param;
		});
	}

	return listener;
};

// Get an existent HTTP host or the main HTTP host
http.getHost = function (server, request) {

	var hostname = (request.headers.host || '').replace(/:\d+$/, '');

	return server.hosts[hostname] || server.hosts.main;
};

// Returns the route to the static files and directories
http.getStaticRoute = function (host, connection, location) {

	var extension = '',
		element = null,
		route = null,
		stats = null,
		timestamp = '';

	// Get the static element
	if (location === 'simples.js') {
		element = http.client;
	} else if (host.cache) {
		element = host.cache.read(location);
	}

	// Check if an element is found
	if (element) {

		// Prepare element data
		extension = path.extname(location).slice(1);
		stats = element.stats;
		timestamp = stats.mtime.toUTCString();

		// Set the last modified time stamp
		connection.header('Last-Modified', timestamp);

		// Set the content type for files
		if (extension) {
			connection.type(extension);
		}

		// Creating the static route for all possible cases
		if (connection.headers['if-modified-since'] === timestamp) {
			route = function (connection) {
				connection.status(304).end();
			};
		} else if (!stats.isDirectory()) {
			route = function (connection) {
				connection.end(element.content);
			};
		} else if (host.routes.serve) {

			// Prepare directory files objects
			connection.data.files = utils.map(element.files, function (name) {
				return element.files[name];
			});

			// Get the route for the static directories
			route = host.routes.serve;
		}
	}

	return route;
};

// Set the session cookies for HTTP connections
http.setSession = function (connection, callback) {

	var host = connection.parent;

	// Prepare session object
	utils.getSession(host, connection, function (connection, session) {

		var config = host.options,
			options = {};

		// Prepare cookies options
		options.expires = config.session.timeout;
		options.path = '/';
		options.httpOnly = true;

		// Write the session cookies
		connection.cookie('_session', session.id, options);
		connection.cookie('_hash', session.hash, options);

		// Link the session container to the connection
		connection.session = session.container;

		// Write the session to the store and remove its reference
		connection.on('finish', function () {
			utils.setSession(host, connection, session);
		});

		// End the session apply
		callback();
	});
};