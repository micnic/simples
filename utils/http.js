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
http.Connection = require('simples/lib/http/connection');

// Link to the HTTP form prototype constructor
http.Form = require('simples/lib/http/form');

// Relations between HTTP methods and used REST verbs
http.verbs = {
	DELETE: 'del',
	GET: 'get',
	HEAD: 'get',
	OPTIONS: 'options',
	POST: 'post',
	PUT: 'put'
};

// Listener for HTTP requests
http.connectionListener = function (host, request, response) {

	var connection = new http.Connection(host, request, response),
		failed = false,
		index = 0,
		length = host.middlewares.length,
		session = host.options.session;

	// Apply middlewares one by one and then apply the route
	function applyMiddlewares(stop) {
		if (index < length && !stop) {
			setImmediate(host.middlewares[index], connection, applyMiddlewares);
			index++;
		} else if (!stop) {
			http.getRoute(connection).call(host, connection);
		}
	}

	// Set the default keep alive timeout to 5 seconds
	connection.keep(host.options.timeout);

	// Process the connection inside a domain
	domain.create().on('error', function (error) {

		// Emit safely the error to the host
		utils.emitError(host, error);

		// Try to apply the route for error 500 or destroy the connection
		if (!connection.started && !failed) {
			failed = true;
			connection.status(500);
			this.bind(host.routes.error[500]).call(host, connection);
		} else {
			connection.destroy();
		}
	}).run(function () {
		if (session.enabled) {
			http.setSession(connection, applyMiddlewares);
		} else {
			applyMiddlewares();
		}
	});
};

// Create a render listener as a shortcut
http.createRenderListener = function (view, importer) {

	var listener = null;

	// Check the type of the importer and prepare the listener
	if (typeof importer === 'function') {
		listener = function (connection) {
			importer(connection, function (data) {
				connection.render(view, data);
			});
		};
	} else {
		listener = function (connection) {
			connection.render(view, importer);
		};
	}

	return listener;
};

// Generate default config for HTTP hosts
http.defaultConfig = function () {

	return {
		compression: {
			enabled: false,
			filter: /^.+$/i,
			options: null, // https://nodejs.org/api/zlib.html#zlib_options
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
		},
		timeout: 5000
	};
};

// Generate empty containers for routes
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
			404: http.notFound,
			405: http.methodNotAllowed,
			500: http.internalServerError
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

// Returns the route which will be applied on the connection
http.getRoute = function (connection) {

	var host = connection.parent,
		location = connection.path.substr(1),
		route = null,
		routes = host.routes,
		verb = http.verbs[connection.method];

	// Check for a valid HTTP method
	if (!verb) {
		connection.status(405).header('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	} else if (verb === 'options') {
		route = http.noContent;
	} else {

		// Try to get the fixed or the dynamic route
		if (routes.fixed[verb][location]) {
			route = routes.fixed[verb][location];
		} else if (routes.fixed.all[location]) {
			route = routes.fixed.all[location];
		} else {
			route = http.getDynamicRoute(connection, routes.dynamic, verb);
		}

		// Try to get the static route
		if (!route && verb === 'get') {
			route = http.getStaticRoute(host, connection, location);
		}

		// Apply the route for HTTP error 404 if no route is defined
		if (!route) {
			connection.status(404);
			route = routes.error[404];
		}
	}

	return route;
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
			route = http.notModified;
		} else if (stats.isFile()) {
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

// Default route for "Internal Server Error" (500 error)
http.internalServerError = function (connection) {
	connection.end('"' + connection.url.path + '" Internal Server Error');
};

// Default route for "Method Not Allowed" (405 error)
http.methodNotAllowed = function (connection) {
	connection.end('"' + connection.method + '" Method Not Allowed');
};

// Route to set HTTP status code to 204 and close the connection
http.noContent = function (connection) {
	connection.status(204).end();
};

// Default route for "Not Found" (404 error)
http.notFound = function (connection) {
	connection.end('"' + connection.url.path + '" Not Found');
};

// Route to set HTTP status code to 304 and close the connection
http.notModified = function (connection) {
	connection.status(304).end();
};

// Set the session cookies for HTTP connections
http.setSession = function (connection, callback) {

	var host = connection.parent;

	// Prepare session object
	utils.getSession(host, connection, function (session) {

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