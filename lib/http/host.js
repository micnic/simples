'use strict';

var cache = require('../../utils/cache'),
	fs = require('fs'),
	url = require('url'),
	utils = require('../../utils/utils'),
	wsHost = require('../ws/host');

// HTTP host prototype constructor
var host = function (parent, name, config) {

	var conf = {},
		logger = {
			stream: process.stdout,
			callback: null
		};

	// Placeholder for rendering callback function
	function nullRender() {
		console.error('simpleS: No template engine defined');
		return 'No template engine defined';
	}

	// Define special properties for the HTTP host configuration
	Object.defineProperties(conf, {
		acceptedOrigins: {
			value: [],
			writable: true
		},
		acceptedReferers: {
			value: [],
			writable: true
		},
		requestLimit: {
			value: 1048576,
			writable: true
		},
		sessionTimeout: {
			value: 3600,
			writable: true
		},
		useCompression: {
			value: true,
			writable: true
		}
	});

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
		name: {
			value: name
		},
		parent: {
			value: parent
		},
		render: {
			value: nullRender,
			writable: true
		},
		routes: {
			value: utils.http.httpDefaultRoutes()
		},
		sessions: {
			value: {}
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

// Set the configuration of the host
host.prototype.config = function (config) {

	var that = this;

	// Use an empty object if config is not defined
	config = config || {};

	// Copy the configuration parameters
	Object.keys(config).forEach(function (element) {
		if (that.conf.hasOwnProperty(element)) {
			that.conf[element] = config[element];
		}
	});

	return this;
};

// Route DELETE requests
host.prototype.del = function (routes, callback) {
	this.route('delete', routes, callback);
	return this;
};

// Remove the host or clean the main host
host.prototype.destroy = function () {
	if (this.name === 'main') {
		this.origins = [];
		this.routes = utils.http.httpDefaultRoutes();
	} else {
		delete this.parent.hosts[this.name];
	}
};

// Specify the template engine to render the responses
host.prototype.engine = function (engine) {

	// Set the rendering method
	this.render = function (source, imports) {
		return engine.render(source, imports);
	};

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

// Remove the route from the host
host.prototype.leave = function (type, routes) {

	var defaultRoutes = utils.http.httpDefaultRoutes(),
		that = this;

	// Remove one single route
	function removeRoute(route) {

		// Remove leading slash
		if (route.charAt(0) === '/') {
			route = route.substr(1);
		}

		// Get the pathname of the route
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (route.indexOf(':') >= 0) {
			delete that.routes[type].advanced[routes];
		} else if (type === 'error') {
			that.routes.error[routes] = defaultRoutes.error[routes];
		} else {
			delete that.routes[type].simple[routes];
		}
	}

	// Check what to remove
	if (Array.isArray(routes)) {
		routes.forEach(function (route) {
			removeRoute(route);
		});
	} else if (typeof routes === 'string') {
		removeRoute(routes);
	} else if (type) {
		this.routes[type] = defaultRoutes[type];
	} else {
		this.routes = defaultRoutes;
	}

	return this;
};

// Create a logger for the connections to the host
host.prototype.log = function (stream, callback) {

	var logger = this.logger;

	// Make stream to be optional
	if (arguments.length === 1) {
		callback = stream;
		stream = this.logger.stream;
	}

	// End last stream
	if ([process.stderr, process.stdout, stream].indexOf(logger.stream) < 0) {
		logger.stream.end();
	}

	// Create a writable stream to file system
	if (typeof stream === 'string') {
		stream = fs.WriteStream(stream);
	}

	// Configure logger
	logger.callback = callback;
	logger.stream = stream;

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
host.prototype.route = function (type, routes, callback) {

	var that = this;

	// Add one single route
	function addRoute(route) {

		// Remove leading slash
		if (route.charAt(0) === '/') {
			route = route.substr(1);
		}

		// Get the pathname of the route
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (route.indexOf(':') < 0) {
			that.routes[type].simple[route] = callback;
		} else {
			that.routes[type].advanced[route] = callback;
		}
	}

	if (['all', 'del', 'get', 'post', 'put'].indexOf(type) < 0) {
		type = 'all';
	}

	// Add the routes to the host
	if (Array.isArray(routes)) {
		routes.forEach(addRoute);
	} else if (typeof routes === 'string') {
		addRoute(routes);
	}

	return this;
};

// Route static files from a specific local directory
host.prototype.serve = function (directory, callback) {
	this.cache.destroy();
	this.cache = new cache(directory);
	this.routes.serve = callback;
	return this;
};

// New WS host
host.prototype.ws = function (location, config, listener) {

	// Get the pathname from the location
	location = url.parse(location).pathname;

	// Create the WS host or configure an existing one
	if (this.wsHosts[location]) {
		this.wsHosts[location].config(config, listener);
	} else {
		this.wsHosts[location] = new wsHost(location, config, listener);
		this.wsHosts[location].parent = this;
	}

	return this.wsHosts[location];
};

module.exports = host;