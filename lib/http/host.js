'use strict';

var cache = require('../../utils/cache'),
	fs = require('fs'),
	httpUtils = require('../http'),
	url = require('url'),
	wsHost = require('../ws/host');

// HTTP host prototype constructor
var host = function (parent, name) {

	var conf = {};

	// Placeholder for rendering callback function
	function nullRender() {
		console.error('simpleS: No template engine defined');
		return 'No template engine defined';
	}

	// Define special properties HTTP host configuration
	Object.defineProperties(conf, {
		compression: { // do compression or not
			value: true,
			writable: true
		},
		limit: { // limit request body in bytes
			value: 1048576,
			writable: true
		},
		origins: { // accepted cors origins
			value: [],
			writable: true
		},
		referers: { // accepted referers
			value: [],
			writable: true
		},
		session: { // the time to live for a session in seconds
			value: 3600,
			writable: true
		}
	});

	// Define special properties for HTTP host
	Object.defineProperties(this, {
		active: {
			value: false,
			writable: true
		},
		cache: {
			value: null,
			writable: true
		},
		conf: {
			value: conf
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
			value: httpUtils.httpDefaultRoutes()
		},
		sessions: {
			value: {},
			writable: true
		},
		timers: {
			value: {},
			writable: true
		},
		wsHosts: {
			value: {}
		}
	});

	// Link the host to the server and activate it
	parent.hosts[name] = this;
	this.open();
};

// Route all types of the requests
host.prototype.all = function (routes, callback) {
	this.route('all', routes, callback);
	return this;
};

// Close the host
host.prototype.close = function () {

	var that = this;

	// Close host only if is active
	if (this.active) {
		Object.keys(this.wsHosts).forEach(function (element) {
			that.wsHosts[element].close();
		});
		this.active = false;
	}

	return this;
};

// Set the configuration of the host
host.prototype.config = function (config) {

	var that = this;

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

// Close and remove the host
host.prototype.destroy = function () {
	this.close();

	// Clean the main host or remove the host
	if (this.name === 'main') {
		this.origins = [];
		this.routes = httpUtils.httpDefaultRoutes();
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
	if ([404, 405, 500].indexOf(code) >= 0) {
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

	var defaultRoutes = httpUtils.httpDefaultRoutes(),
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

// Start the host
host.prototype.open = function () {

	var that = this;

	// Open host only if is not active
	if (!this.active) {
		Object.keys(this.wsHosts).forEach(function (element) {
			that.wsHosts[element].open();
		});
		this.active = true;
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

	// Add the routes to the host
	if (Array.isArray(routes)) {
		routes.forEach(function (route) {
			addRoute(route);
		});
	} else if (typeof routes === 'string') {
		addRoute(routes);
	}

	return this;
};

// Route static files from a specific local directory
host.prototype.serve = function (directory, callback) {
	this.routes.serve = callback;
	this.cache = new cache(directory);
	return this;
};

// New WebSocket host
host.prototype.ws = function (location, config, callback) {

	// Check the number of parameters
	if (arguments.length === 2) {
		callback = config;
		config = {};
	}

	// Get the pathname of the location
	location = url.parse(location).pathname;

	// Set default config
	config.limit = config.limit || 1048576;
	config.protocols = config.protocols || [];
	config.raw = config.raw || false;

	// Create the WebSocket host
	this.wsHosts[location] = new wsHost(location, config, callback);
	this.wsHosts[location].parent = this;

	return this.wsHosts[location];
};

module.exports = host;