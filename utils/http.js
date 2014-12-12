'use strict';

var cache = require('simples/lib/cache'),
	domain = require('domain'),
	path = require('path'),
	url = require('url'),
	utils = require('simples/utils/utils');

// HTTP namespace
var http = exports;

// Link to the HTTP connection prototype constructor
http.connection = require('simples/lib/http/connection');

// Link to the HTTP form prototype constructor
http.form = require('simples/lib/http/form');

// Relations between HTTP methods and used REST verbs
http.verbs = {
	'DELETE': 'del',
	'GET': 'get',
	'HEAD': 'get',
	'POST': 'post',
	'PUT': 'put'
};

// Manage the behavior of the route
http.applyRoute = function (connection, route) {
	if (typeof route === 'function') {
		route.call(connection.parent, connection);
	} else if (typeof route === 'string') {
		connection.render(route);
	}
};

// Apply the routes for static files and directories
http.applyStaticRoute = function (connection, route) {

	var directory = null,
		extension = '',
		host = connection.parent,
		routes = host.routes,
		stats = route.stats,
		time = stats.mtime.toUTCString();

	// Set the last modified time
	connection.header('Last-Modified', time);

	// Check if the resources were modified after last access
	if (connection.headers['if-modified-since'] === time) {
		connection.status(304).end();
	} else if (stats.isDirectory()) {

		// Prepare directory items
		directory = Object.keys(route.files).map(function (name) {
			return route.files[name];
		});

		// Apply the route for the directory
		routes.serve.call(host, connection, directory);
	} else {

		// Prepare file extension
		extension = path.extname(route.location).slice(1);

		// Set the content type of the response
		connection.type(extension).end(route.content);
	}
};

// Listener for HTTP requests
http.connectionListener = function (host, request, response) {

	var config = host.conf,
		connection = new http.connection(host, request, response),
		failed = false,
		index = 0,
		length = host.middlewares.length,
		location = connection.path.substr(1),
		route = null,
		routes = host.routes,
		verb = http.verbs[connection.method];

	// Get middlewares one by one and execute them
	function nextMiddleware(stop) {
		if (index < length && !stop) {
			setImmediate(host.middlewares[index], connection, nextMiddleware);
			index++;
		} else if (!stop) {

			// Set the default keep alive timeout to 5 seconds
			connection.keep(5000);

			// Apply the route
			if (utils.isObject(route)) {
				http.applyStaticRoute(connection, route);
			} else if (config.session.enabled) {
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
	}

	// Get static content if found
	if (!route && verb === 'get' && http.refers(host, connection)) {

		// Check for client side API file serve
		if (location === 'simples.js') {
			route = cache.client;
		} else {
			route = host.cache.read(location);
		}

		// Do not use routes to directories if no serve route is defined
		if (route && route.stats.isDirectory() && !routes.serve) {
			route = null;
		}
	}

	// Check for errors 404 and 405
	if (connection.method === 'OPTIONS') {
		connection.status(204).end();
	} else if (!verb) {
		connection.status(405).header('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	} else if (!route) {
		connection.status(404);
		route = routes.error[404];
	}

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
	}).run(nextMiddleware);
};

// Create a render listener as a shortcut
http.createRenderListener = function (view, importer) {
	return function (connection) {
		connection.render(view, importer);
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

/*0.7 move this function to a middleware or remove*/
// Check if the referer header is accepted by the host
http.refers = function (host, connection) {

	var hostname = url.parse(connection.headers.referer || '').hostname,
		referers = host.conf.referers,
		valid = true;

	// Check if referer is found in the accepted referers list
	if (referers.length && hostname !== connection.host) {
		if (referers.indexOf(hostname) < 0) {
			valid = referers[0] === '*';
		} else {
			valid = referers[0] !== '*';
		}
	}

	return valid;
};

// Set the session cookies for HTTP connections
http.setSession = function (connection, callback) {

	var host = connection.parent;

	// Prepare session object
	utils.getSession(host, connection, function (connection, session) {

		var config = host.conf,
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