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

http.applyRoute = function (connection, route) {
	if (typeof route === 'function') {
		route.call(connection.parent, connection);
	} else if (typeof route === 'string') {
		connection.render(route);
	}
};

// Apply the selected route
http.prepareRoute = function (connection, route) {

	var config = connection.parent.conf;

	// Set the default keep alive timeout to 5 seconds
	connection.keep(5000);

	// Apply the route
	if (utils.isObject(route)) {
		http.applyStaticRoute(connection, route);
	} else if (config.session.enabled) {
		http.setSession(connection, function () {
			http.applyRoute(connection, route);
		});
	} else {
		http.applyRoute(connection, route);
	}
};

// Apply the routes for static files and directories
http.applyStaticRoute = function (connection, route) {

	var directory = null,
		extension = '',
		host = connection.parent,
		mtime = 0,
		routes = host.routes,
		stats = route.stats;

	// Check if the route is a directory or a file
	if (stats.isDirectory()) {

		// Prepare directory items
		directory = Object.keys(route.files).map(function (name) {

			var item = {};

			// Prepare item object
			item.name = name;
			item.stats = route.files[name].stats;

			return item;
		});

		// Apply the route for the directory
		routes.serve.call(host, connection, directory);
	} else {

		// Prepare route properties
		extension = path.extname(route.location).slice(1);
		mtime = stats.mtime.valueOf();

		// Set the last modified time and the content type of the response
		connection.header('Last-Modified', mtime).type(extension);

		// Check if modification time coincides on the client and on the server
		if (Number(connection.headers['if-modified-since']) === mtime) {
			connection.status(304).end();
		} else {
			connection.end(route.content);
		}
	}
};

// Listener for HTTP requests
http.connectionListener = function (host, request, response) {

	var connection = new http.connection(host, request, response);

	// Prepare connection for routing
	if (connection.method === 'OPTIONS') {
		connection.end();
	} else {
		http.routing(connection);
	}
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

	// Populate connection parameters if the route is found
	if (result) {
		location.match(route.pattern).slice(1).forEach(function (param, key) {
			connection.params[route.keys[key]] = param;
		});
	}

	return result;
};

// Check if the referer header is accepted by the host
http.refers = function (host, connection) {

	var hostname = '',
		referers = host.conf.referers,
		valid = true;

	// Check for the referer hostname
	if (connection.headers.referer) {
		hostname = url.parse(connection.headers.referer).hostname;
	}

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

// Routes all the requests
http.routing = function (connection) {

	var host = connection.parent,
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
			http.prepareRoute(connection, route);
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
	}

	// Check for errors 404 and 405
	if (!verb) {
		connection.status(405).header('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	} else if (!route) {
		connection.status(404);
		route = routes.error[404];
	}

	// Wrap the connection inside a domain
	domain.create().on('error', function (error) {

		// Emit safely the error to the host
		utils.emitError(host, error, true);

		// Try to apply the route for error 500 or destroy the connection
		if (!connection.started && connection.status() !== 500) {
			connection.status(500);
			this.bind(routes.error[500]).call(host, connection);
		} else {
			connection.destroy();
		}
	}).run(nextMiddleware);
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

		callback();
	});
};