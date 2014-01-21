'use strict';

var cache = require('simples/utils/cache'),
	fs = require('fs'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	wsHost = require('simples/lib/ws/host');

// HTTP host prototype constructor
var host = function (parent, config) {

	var conf = {},
		logger = {};

	// Define properties for the HTTP host configuration
	conf.compression = {
		enabled: true,
		options: null // http://nodejs.org/api/zlib.html#zlib_options
	};
	conf.limit = 1048576;
	conf.origins = [];
	conf.referers = [];
	conf.session = {
		enabled: false,
		key: '_session',
		hash: '_hash',
		secret: '',
		timeout: 3600 // 0 for browser session
	};

	// Define logger properties
	logger.callback = null;
	logger.stream = process.stdout;

	// Define special properties for the HTTP host
	Object.defineProperties(this, {
		cache: {
			value: new cache(),
			writable: true
		},
		conf: {
			value: conf
		},
		logger: {
			value: logger
		},
		middlewares: {
			value: []
		},
		parent: {
			value: parent
		},
		routes: {
			value: utils.http.defaultRoutes()
		},
		sessions: {
			value: {}
		},
		tengine: {
			value: null,
			writable: true
		},
		timers: {
			value: {}
		},
		wsHosts: {
			value: {}
		}
	});

	// Configure the HTTP host
	this.config(config);
};

// Route all types of the requests
host.prototype.all = function (routes, callback) {
	this.route('all', routes, callback);
	return this;
};

// Remove close all WS hosts and remove sessions
host.prototype.close = function () {

	// Clear the session timers
	Object.keys(host.timers).forEach(function (timer) {
		clearTimeout(host.timers[timer]);
	});

	// Clear the WS hosts
	Object.keys(host.wsHosts).forEach(function (wsHost) {
		host.wsHosts[wsHost].close();
	});

	return this;
};

// Set the configuration of the host
host.prototype.config = function (config) {

	// Use an empty object if config is not an object
	if (!config || typeof config !== 'object') {
		config = {};
	}

	// Copy the configuration object
	utils.copyConfig(this.conf, config);

	return this;
};

// Route DELETE requests
host.prototype.del = function (routes, callback) {
	this.route('delete', routes, callback);
	return this;
};

// Remove the host or clean the main host
host.prototype.destroy = function () {

	var name = '',
		that = this;

	// Find this host name
	Object.keys(this.parent.hosts).forEach(function (host) {
		if (this.parent.hosts[host] === that) {
			name = host;
		}
	});

	// Check for the main or a simple host
	if (name === 'main') {
		this.conf.origins = [];
		this.conf.referers = [];
		this.routes = utils.http.defaultRoutes();
	} else {
		delete this.parent.hosts[name];
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
	if (this.routes.error[code]) {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
host.prototype.get = function (routes, callback) {
	this.route('get', routes, callback);
	return this;
};

// Remove the routes from the host
host.prototype.leave = function (verb, routes) {

	var defaultRoutes = utils.http.defaultRoutes(),
		that = this;

	// Remove one single route
	function removeRoute(route) {

		// Remove leading slash
		if (route[0] === '/') {
			route = route.substr(1);
		}

		// Get the pathname of the route
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (route.indexOf(':') >= 0) {
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
		this.routes.serve = null;
	} else if (verb && verb !== 'error' && verb !== 'serve') {
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
		stream = fs.WriteStream(stream);
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
	this.route('post', routes, callback);
	return this;
};

// Route DELETE requests
host.prototype.put = function (routes, callback) {
	this.route('put', routes, callback);
	return this;
};

// Add all kinds of routes
host.prototype.route = function (verb, routes, callback) {

	var that = this;

	// Add one single route
	function addRoute(route) {

		// Remove leading slash
		if (route[0] === '/') {
			route = route.substr(1);
		}

		// Get the pathname of the route
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (route.indexOf(':') < 0) {
			that.routes.fixed[verb][route] = callback;
		} else {
			that.routes.dynamic[verb][route] = callback;
		}
	}

	// Validate the parameters and add the routes
	if (typeof verb === 'string' && typeof callback === 'function') {

		// Set 'all' verb as default
		if (['all', 'del', 'get', 'post', 'put'].indexOf(verb) < 0) {
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

	// Check for a valid location
	if (typeof location === 'string') {

		// Add leading slash to the location
		if (location[0] !== '/') {
			location = '/' + location;
		}

		// Get the pathname from the location
		location = url.parse(location).pathname || '/';
	} else {
		location = '/';
	}

	// Create the WS host or configure an existing one
	if (this.wsHosts[location]) {
		this.wsHosts[location].config(config, callback);
	} else {
		this.wsHosts[location] = new wsHost(this, config, callback);
	}

	return this.wsHosts[location];
};

module.exports = host;