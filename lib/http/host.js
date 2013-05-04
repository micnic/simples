'use strict';

var path = require('path'),
	url = require('url'),
	utils = require('../../utils/utils'),
	wsHost = require('../ws/host');

// Host prototype constructor
var host = module.exports = function (parent, name) {

	// Set the host properties
	Object.defineProperties(this, {
		name: {
			value: name
		},
		origins: {
			value: [],
			writable: true
		},
		parent: {
			value: parent
		},
		referers: {
			value: [],
			writable: true
		},
		render: {
			value: null,
			writable: true
		},
		routes: {
			value: utils.defaultRoutes()
		},
		sessions: {
			value: {},
			writable: true
		},
		started: {
			value: false,
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

	this.open();
};

// Accept requests from other origins
host.prototype.accept = function () {

	// Reset the origins and prepare for pushing arguments
	var index = arguments.length;
	this.origins = [];

	// Push the arguments to the origins
	while (index--) {
		this.origins[index] = arguments[index];
	}

	return this;
};

// Route both GET and POST requests
host.prototype.all = function (route, callback) {
	utils.addRoute.call(this, 'all', route, callback);
	return this;
};

// Stops the host
host.prototype.close = function () {

	var index;

	// Close host only if is started
	if (this.started) {
		for (index in this.wsHosts) {
			this.wsHosts[index].close();
		}
		this.started = false;
	}

	return this;
};

// Stop and remove the host
host.prototype.destroy = function () {
	this.close();

	// Clean the main host or remove the host
	if (this.name === 'main') {
		this.origins = [];
		this.routes = utils.defaultRoutes();
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
	if (this.routes.error.hasOwnProperty(code)) {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
host.prototype.get = function (route, callback) {
	utils.addRoute.call(this, 'get', route, callback);
	return this;
};

// Remove the route from the host
host.prototype.leave = function (type, route) {
	var defaultRoutes = utils.defaultRoutes();

	// Check if route or type is defined
	if (route) {

		if (Array.isArray(route)) {
			for (var i = 0; i < route.length; i++) {
				// Remove root and get pathname
				if (route[i].charAt(0) === '/') {
					route[i] = route[i].substr(1);
				}
				route[i] = url.parse(route[i]).pathname || '';

				// Check for advanced route
				if (~route[i].indexOf(':')) {
					delete this.routes[type].advanced[route[i]];
				} else {
					if (type === 'error') {
						this.routes.error[route[i]] = defaultRoutes.error[route[i]];
					} else {
						delete this.routes[type].raw[route[i]];
					}
				}
			}
		} else if (typeof route === 'string') {
			// Remove root and get pathname
			if (route.charAt(0) === '/') {
				route = route.substr(1);
			}
			route = url.parse(route).pathname || '';

			// Check for advanced route
			if (~route.indexOf(':')) {
				delete this.routes[type].advanced[route];
			} else {
				if (type === 'error') {
					this.routes.error[route] = defaultRoutes.error[route];
				} else {
					delete this.routes[type].raw[route];
				}
			}
		}
	} else if (type) {
		this.routes[type] = defaultRoutes[type];
	} else {
		this.routes = defaultRoutes;
	}
	
	return this;
};

// Start the host
host.prototype.open = function () {

	var index;

	// Open host only if is not started
	if (!this.started) {
		for (index in this.wsHosts) {
			this.wsHosts[index].open();
		}
		this.started = true;
	}

	return this;
};

// Route post requests
host.prototype.post = function (route, callback) {
	utils.addRoute.call(this, 'post', route, callback);
	return this;
};

// Specify referer access
host.prototype.referer = function () {

	// Reset the origins and prepare for pushing arguments
	var index = arguments.length;
	this.referers = [];

	// Push the arguments to the origins
	while (index--) {
		this.referers[index] = arguments[index];
	}

	return this;
};

// Route static files from a specific local path
host.prototype.serve = function (path, callback) {
	utils.addRoute.call(this, 'serve', path, callback);
	return this;
};

// New WebSocket host
host.prototype.ws = function (location, config, callback) {

	location = url.parse(location).pathname;

	// Set default config
	config.length = config.length || 1048576;
	config.protocols = config.protocols || [];
	config.raw = config.raw || false;

	// Create the WebSocket host
	this.wsHosts[location] = new wsHost(location, config, callback);
	this.wsHosts[location].parent = this;

	return this.wsHosts[location];
};