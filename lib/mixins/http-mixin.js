'use strict';

var domain = require('domain'),
	fs = require('fs'),
	HttpConnection = require('simples/lib/http/connection'),
	path = require('path'),
	utils = require('simples/utils/utils');

var HttpMixin = {};

// Client file object
HttpMixin.client = {};

// Prepare client file data
try {
	HttpMixin.client.location = path.join(__dirname, '../../utils/client.js');
	HttpMixin.client.stats = fs.statSync(HttpMixin.client.location);
	HttpMixin.client.content = fs.readFileSync(HttpMixin.client.location);
} catch (error) {
	// eslint-disable-next-line
	console.error('\nCan not prepare simpleS client file');
	// eslint-disable-next-line
	console.error(error.stack + '\n');
}

// Relations between HTTP methods and used REST verbs
HttpMixin.verbs = {
	DELETE: 'del',
	GET: 'get',
	HEAD: 'get',
	OPTIONS: 'options',
	POST: 'post',
	PUT: 'put'
};

// Default route for "Internal Server Error" (500 error)
HttpMixin.internalServerError = function (connection) {
	connection.end('"' + connection.url.path + '" Internal Server Error');
};

// Default route for "Method Not Allowed" (405 error)
HttpMixin.methodNotAllowed = function (connection) {
	connection.end('"' + connection.method + '" Method Not Allowed');
};

// Default route for "Not Found" (404 error)
HttpMixin.notFound = function (connection) {
	connection.end('"' + connection.url.path + '" Not Found');
};

// Route to set HTTP status code to 204 and close the connection
HttpMixin.noContent = function (connection) {
	connection.status(204).end();
};

// Route to set HTTP status code to 304 and close the connection
HttpMixin.notModified = function (connection) {
	connection.status(304).end();
};

// Get an dynamic HTTP host if it exists
HttpMixin.getDynamicHost = function (server, name) {

	var host = server.hosts.main,
		hosts = server.hosts.dynamic,
		index = 0,
		keys = Object.keys(hosts),
		length = keys.length;

	// Get the index of the dynamic host
	while (index < length && !hosts[keys[index]].pattern.test(name)) {
		index++;
	}

	// Select the dynamic host if it was found
	if (index < length) {
		host = hosts[keys[index]];
	}

	return host;
};

// Get an existent HTTP host or the main HTTP host
HttpMixin.getHost = function (server, request) {

	var host = server.hosts.main,
		name = request.headers.host;

	// Check for host header
	if (name) {

		// Remove the port value from the host name
		name = name.replace(/:\d+$/, '');

		// Check for an existing host
		if (server.hosts.fixed[name]) {
			host = server.hosts.fixed[name];
		} else {
			host = HttpMixin.getDynamicHost(server, name);
		}
	}

	return host;
};

// Returns the route to the static files and directories
HttpMixin.getStaticListener = function (host, connection, location) {

	var extension = '',
		element = null,
		listener = null,
		stats = null,
		timestamp = '';

	// Get the static element
	if (location === 'simples.js') {
		element = HttpMixin.client;
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

		// Creating the static listener for all possible cases
		if (connection.headers['if-modified-since'] === timestamp) {
			listener = HttpMixin.notModified;
		} else if (stats.isFile()) {
			listener = function (connection) {
				connection.end(element.content);
			};
		} else if (host.routes.serve) {

			// Prepare directory files objects
			connection.data.files = utils.map(element.files, function (name) {
				return element.files[name];
			});

			// Get the route for the static directories
			listener = host.routes.serve;
		}
	}

	return listener;
};

// Returns the dynamic route if found
HttpMixin.getDynamicRoute = function (connection, routes, verb) {

	var location = connection.path.substr(1),
		index = 0,
		keys = Object.keys(routes[verb]),
		length = keys.length,
		route = routes[verb][keys[0]];

	// Get the index of the dynamic route
	while (index < length && !route.pattern.test(location)) {

		// Get the next index
		index++;

		// Search ALL verb routes in case the listener was not found
		if (index === length) {
			if (verb !== 'all') {
				index = 0;
				keys = Object.keys(routes.all);
				length = keys.length;
				verb = 'all';
			}
		} else {
			route = routes[verb][keys[index]];
		}
	}

	// Select the route and populate the connection parameters
	if (index < length) {
		route = routes[verb][keys[index]];
		location.match(route.pattern).slice(1).forEach(function (param, key) {
			connection.params[route.keys[key]] = param;
		});
	} else {
		route = null;
	}

	return route;
};

// Returns the route which will be applied on the connection
HttpMixin.getRouteListener = function (connection) {

	var host = connection.parent,
		listener = null,
		location = connection.path.substr(1),
		route = null,
		routes = host.routes,
		verb = HttpMixin.verbs[connection.method];

	// Check for a valid HTTP method
	if (!verb) {
		connection.status(405).header('Allow', 'DELETE,GET,HEAD,POST,PUT');
		listener = routes.error[405];
	} else if (verb === 'options') {
		listener = HttpMixin.noContent;
	} else {

		// Try to get the fixed or the dynamic route
		if (routes.fixed[verb][location]) {
			route = routes.fixed[verb][location];
		} else if (routes.fixed.all[location]) {
			route = routes.fixed.all[location];
		} else {
			route = HttpMixin.getDynamicRoute(connection, routes.dynamic, verb);
		}

		// Check if the route was selected to get the listener
		if (route) {
			listener = route.listener;
		}

		// Try to get the static listener if no route was selected
		if (!listener && verb === 'get') {
			listener = HttpMixin.getStaticListener(host, connection, location);
		}

		// Select the listener for HTTP error 404 if no listener was selected
		if (!listener) {
			connection.status(404);
			listener = routes.error[404];
		}
	}

	return listener;
};

// Process HTTP requests
HttpMixin.connectionListener = function (host, request, response) {

	var connection = HttpConnection.create(host, request, response),
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
			HttpMixin.getRouteListener(connection).call(host, connection);
		}
	}

	// Set the host keep alive timeout
	connection.keep(host.options.timeout);

	// Process the connection inside a domain
	domain.create().on('error', function (error) {

		// Emit safely the error to the host
		utils.emitError(host, error);

		// Try to apply the route for error 500 or destroy the connection
		if (!connection.started && !failed) {
			failed = true;
			connection.status(500);
			connection.data.error = error;
			this.bind(host.routes.error[500]).call(host, connection);
		} else {
			connection.destroy();
		}
	}).run(function () {
		if (session.enabled) {
			HttpMixin.setSession(connection, applyMiddlewares);
		} else {
			applyMiddlewares();
		}
	});
};

// Set the session cookies for HTTP connections
HttpMixin.setSession = function (connection, callback) {

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

module.exports = HttpMixin;