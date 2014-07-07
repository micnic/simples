'use strict';

var cache = require('simples/lib/cache'),
	fs = require('fs'),
	url = require('url'),
	utils = require('simples/utils/utils');

// HTTP host prototype constructor
var host = function (parent, name, config) {

	var logger = {};

	// Define logger properties
	logger.callback = null;
	logger.stream = process.stdout;

	// Define private properties for HTTP host
	Object.defineProperties(this, {
		cache: {
			value: new cache(),
			writable: true
		},
		conf: {
			value: utils.http.defaultConfig(),
			writable: true
		},
		logger: {
			value: logger
		},
		middlewares: {
			value: []
		},
		name: {
			value: name
		},
		parent: {
			value: parent
		},
		routes: {
			value: utils.http.defaultRoutes(),
			writable: true
		},
		tengine: {
			value: null,
			writable: true
		},
		timer: {
			value: null,
			writable: true
		}
	});

	// Configure the HTTP host
	this.config(config);
};

// Route all types of the requests
host.prototype.all = function (routes, callback) {
	return this.route('all', routes, callback);
};

// Remove close all WS hosts and remove sessions
host.prototype.close = function () {

	var that = this;

	// Clear the WS hosts
	Object.keys(this.routes.ws).forEach(function (route) {
		that.routes.ws[route].close();
	});

	return this;
};

// Set the configuration of the host
host.prototype.config = function (config) {

	var session = null;

	// Use an empty object if config is not an object
	if (!utils.isObject(config)) {
		config = {};
	}

	// Copy the configuration object
	utils.copyConfig(this.conf, config);

	session = this.conf.session;

	// Check for enabled session and set the timer
	if (session.enabled && session.timeout) {
		clearInterval(this.timer);
		this.timer = setInterval(function () {
			session.store.clean();
		}, session.timeout * 1000).unref();
	}

	return this;
};

// Route DELETE requests
host.prototype.del = function (routes, callback) {
	return this.route('del', routes, callback);
};

// Remove the host or clean the main host
host.prototype.destroy = function () {

	// Before destoying the host, close it
	this.close();

	// Check for the main or a simple host
	if (this.name === 'main') {
		this.conf = utils.http.defaultConfig();
		this.routes = utils.http.defaultRoutes();
	} else {
		delete this.parent.hosts[this.name];
	}
};

// Specify the template engine to render the responses
host.prototype.engine = function (engine) {

	// Validate template engine
	if (engine.render) {
		this.tengine = engine;
	} else {
		console.error('\nsimpleS: Invalid template engine\n');
	}

	return this;
};

// Route errors
host.prototype.error = function (code, callback) {

	// Accept only 404, 405 and 500 error codes
	if (this.routes.error[code] && typeof callback === 'function') {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
host.prototype.get = function (routes, callback) {
	return this.route('get', routes, callback);
};

// Remove the routes from the host
host.prototype.leave = function (verb, routes) {

	var defaultRoutes = utils.http.defaultRoutes(),
		that = this;

	// Remove one single route
	function removeRoute(route) {

		// Remove redundant whitespace
		route = route.trim();

		// Remove leading slash
		if (route[0] === '/') {
			route = route.substr(1);
		}

		// Get the pathname of the route
		if (route) {
			route = url.parse(route).pathname;
		} else {
			route = '';
		}

		// Check for routes with named parameters
		if (route.indexOf(':') >= 0 || route.indexOf('*') >= 0) {
			delete that.routes.dynamic[verb][route];
		} else if (verb === 'error') {
			that.routes.error[route] = defaultRoutes.error[route];
		} else {
			delete that.routes.fixed[verb][route];
		}
	}

	// Check what to remove
	if (Array.isArray(routes)) {
		routes.forEach(removeRoute);
	} else if (typeof routes === 'string') {
		removeRoute(routes);
	} else if (verb === 'error') {
		this.routes.error = defaultRoutes.error;
	} else if (verb === 'serve') {
		this.cache.destroy();
		this.cache = new cache();
		this.routes.serve = null;
	} else if (['all', 'del', 'get', 'post', 'put'].indexOf(verb) >= 0) {
		this.routes.dynamic[verb] = defaultRoutes.dynamic[verb];
		this.routes.fixed[verb] = defaultRoutes.fixed[verb];
	} else {
		this.routes = defaultRoutes;
	}

	return this;
};

// Create a logger for the connections to the host
host.prototype.log = function (stream, callback) {

	var logger = this.logger;

	// Make stream to be optional
	if (typeof stream === 'function') {
		callback = stream;
		stream = logger.stream;
	} else if (typeof stream === 'string') {
		stream = new fs.WriteStream(stream);
	}

	// End last stream
	if ([process.stderr, process.stdout, stream].indexOf(logger.stream) < 0) {
		logger.stream.end();
	}

	// Configure logger
	logger.callback = callback;
	logger.stream = stream;

	return this;
};

// Add a middleware to the host
host.prototype.middleware = function (callback, remove) {

	var index = this.middlewares.indexOf(callback);

	// Check if the middleware already exists
	if (remove && index >= 0) {
		this.middlewares.splice(index, 1);
	} else if (index < 0) {
		this.middlewares.push(callback);
	}

	return this;
};

// Route post requests
host.prototype.post = function (routes, callback) {
	return this.route('post', routes, callback);
};

// Route DELETE requests
host.prototype.put = function (routes, callback) {
	return this.route('put', routes, callback);
};

// Add all kinds of routes
host.prototype.route = function (verb, routes, callback) {

	var that = this;

	// Add a route with dynamic parameters
	function addDynamicRoute(verb, route, callback) {

		var pattern = '',
			keys = [];

		// Escape all RegExp special characters except "*"
		pattern = route.replace(utils.escapeRegExp, '\\$&');

		// Replace "*" with any match
		pattern = pattern.replace(utils.allPatternRegExp, '.*?');

		// Prepare dynamic parameters match
		pattern = pattern.replace(utils.paramsRegExp, function (match, key) {
			keys.push(key);
			return '([^\\/]+)';
		});

		// Add the dynamic route
		that.routes.dynamic[verb][route] = {
			callback: callback,
			keys: keys,
			pattern: new RegExp('^' + pattern + '$')
		};
	}

	// Add one single route
	function addRoute(route) {

		// Remove redundant whitespace
		route = route.trim();

		// Remove leading slash
		if (route[0] === '/') {
			route = route.substr(1);
		}

		// Get the pathname of the route
		if (route) {
			route = url.parse(route).pathname;
		} else {
			route = '';
		}

		// Check for routes with named parameters
		if (route.indexOf(':') >= 0 || route.indexOf('*') >= 0) {
			addDynamicRoute(verb, route, callback);
		} else {
			that.routes.fixed[verb][route] = callback;
		}
	}

	// Validate the parameters and add the routes
	if (typeof verb === 'string' && typeof callback === 'function') {

		// Set 'all' verb as default
		if (['del', 'get', 'post', 'put'].indexOf(verb) < 0) {
			verb = 'all';
		}

		// Add the routes to the host
		if (Array.isArray(routes)) {
			routes.forEach(addRoute);
		} else if (typeof routes === 'string') {
			addRoute(routes);
		}
	}

	return this;
};

// Route static files from a specific local directory
host.prototype.serve = function (directory, callback) {

	// Validate the parameters and create the cache
	if (typeof directory === 'string') {

		// Destroy the existing cache and create a new one
		this.cache.destroy();
		this.cache = new cache(directory);

		// Validate and set the callback for serving subdirectories
		if (typeof callback === 'function') {
			this.routes.serve = callback;
		} else {
			this.routes.serve = null;
		}
	}

	return this;
};

// New WS host
host.prototype.ws = function (location, config, callback) {

	var routes = this.routes;

	// Check for a valid location
	if (location && typeof location === 'string') {

		// Remove redundant whitespace
		location = location.trim();

		// Add leading slash to the location
		if (location[0] !== '/') {
			location = '/' + location;
		}

		// Get the pathname from the location
		location = url.parse(location).pathname;
	} else {
		location = '/';
	}

	// Create the WS host or configure an existing one
	if (routes.ws[location]) {
		routes.ws[location].config(config, callback);
	} else {
		routes.ws[location] = new utils.ws.host(location, config, callback);
		routes.ws[location].parent = this;
	}

	return this.routes.ws[location];
};

module.exports = host;