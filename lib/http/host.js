'use strict';

var events = require('events'),
	recache = require('recache'),
	url = require('url'),
	utils = require('simples/utils/utils');

// HTTP host prototype constructor
var Host = function (server, name) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for HTTP host
	Object.defineProperties(this, {
		cache: {
			value: null,
			writable: true
		},
		middlewares: {
			value: []
		},
		name: {
			value: name
		},
		server: {
			value: server
		},
		options: {
			value: utils.http.defaultConfig(),
			writable: true
		},
		routes: {
			value: utils.http.defaultRoutes(),
			writable: true
		},
		tengine: {
			value: null,
			writable: true
		}
	});
};

// Inherit from events.EventEmitter
Host.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Host
	}
});

// Route all types of the requests
Host.prototype.all = function (routes, listener, importer) {

	// Check for render listener
	if (typeof listener === 'string') {
		listener = utils.http.createRenderListener(listener, importer);
	}

	return this.route('all', routes, listener);
};

// Set the configuration of the host
Host.prototype.config = function (options) {

	// Set the compression options if available
	if (options.compression && typeof options.compression === 'object') {
		utils.assign(this.options.compression, options.compression);
	}

	// Set the CORS options if available
	if (options.cors && typeof options.cors === 'object') {
		utils.assign(this.options.cors, options.cors);
	}

	// Set the session options if available
	if (options.session && typeof options.session === 'object') {
		utils.assign(this.options.session, options.session);
	}

	// Set the timeout option if available
	if (typeof options.timeout === 'number') {
		this.options.timeout = options.timeout;
	}

	return this;
};

// Route DELETE requests
Host.prototype.del = function (routes, listener, importer) {

	// Check for render listener
	if (typeof listener === 'string') {
		listener = utils.http.createRenderListener(listener, importer);
	}

	return this.route('del', routes, listener);
};

// Remove the host or clean the main host
Host.prototype.destroy = function () {

	var that = this;

	// Destroy all WebSocket hosts that are related to this HTTP host
	Object.keys(this.routes.ws).forEach(function (route) {
		that.routes.ws[route].destroy();
	});

	// Check for the main or another host
	if (this.name === 'main') {
		this.options = utils.http.defaultConfig();
		this.routes = utils.http.defaultRoutes();
	} else {
		delete this.server.hosts[this.name];
	}
};

// Specify the template engine to render the responses
Host.prototype.engine = function (engine) {

	// Validate template engine
	if (engine && engine.render) {
		this.tengine = engine;
	}

	return this;
};

// Route errors
Host.prototype.error = function (code, listener, importer) {

	// Check for render listener
	if (typeof listener === 'string') {
		listener = utils.http.createRenderListener(listener, importer);
	}

	// Accept only 404, 405 and 500 error codes
	if (this.routes.error[code] && typeof listener === 'function') {
		this.routes.error[code] = listener;
	}

	return this;
};

// Route GET requests
Host.prototype.get = function (routes, listener, importer) {

	// Check for render listener
	if (typeof listener === 'string') {
		listener = utils.http.createRenderListener(listener, importer);
	}

	return this.route('get', routes, listener);
};

// Remove the routes from the host
Host.prototype.leave = function (verb, routes) {

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
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (/\:|\*/i.test(route)) {
			delete that.routes.dynamic[verb][route];
		} else {
			delete that.routes.fixed[verb][route];
		}
	}

	// Check what to remove
	if (verb === 'error') {
		if (typeof routes === 'number' && this.routes.error[routes]) {
			this.routes.error[routes] = defaultRoutes.error[routes];
		} else {
			this.routes.error = defaultRoutes.error;
		}
	} else if (Array.isArray(routes)) {
		routes.forEach(removeRoute);
	} else if (typeof routes === 'string') {
		removeRoute(routes);
	} else if (verb === 'serve') {

		// Destroy the existing cache container
		if (this.cache) {
			this.cache.destroy();
			this.cache = null;
		}

		// Remove the route for the served directory
		this.routes.serve = null;
	} else if (/^(?:all|del|get|post|put)$/.test(verb)) {
		this.routes.dynamic[verb] = defaultRoutes.dynamic[verb];
		this.routes.fixed[verb] = defaultRoutes.fixed[verb];
	} else {
		this.routes = defaultRoutes;
	}

	return this;
};

// Add or remove a middleware
Host.prototype.middleware = function (callback, remove) {

	var index = this.middlewares.indexOf(callback);

	// Check if the middleware already exists
	if (remove === true && index >= 0) {
		this.middlewares.splice(index, 1);
	} else if (remove !== true && index < 0) {
		this.middlewares.push(callback);
	}

	return this;
};

// Route POST requests
Host.prototype.post = function (routes, listener, importer) {

	// Check for render listener
	if (typeof listener === 'string') {
		listener = utils.http.createRenderListener(listener, importer);
	}

	return this.route('post', routes, listener);
};

// Route PUT requests
Host.prototype.put = function (routes, listener, importer) {

	// Check for render listener
	if (typeof listener === 'string') {
		listener = utils.http.createRenderListener(listener, importer);
	}

	return this.route('put', routes, listener);
};

// Add all kinds of routes
Host.prototype.route = function (verb, routes, listener) {

	var that = this;

	// Add a route with dynamic parameters
	function addDynamicRoute(verb, route, listener) {

		var pattern = '',
			keys = [];

		// Escape all RegExp special characters except "*"
		pattern = route.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/gi, '\\$&');

		// Replace "*" with any match
		pattern = pattern.replace(/\*/gi, '.*?');

		// Prepare dynamic parameters match
		pattern = pattern.replace(/:([^\\.]+)/gi, function (match, key) {
			keys.push(key);
			return '([^\\/]+)';
		});

		// Add the dynamic route
		that.routes.dynamic[verb][route] = {
			keys: keys,
			listener: listener,
			pattern: RegExp('^' + pattern + '$')
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
		route = url.parse(route).pathname || '';

		// Check for routes with named parameters
		if (/\:|\*/i.test(route)) {
			addDynamicRoute(verb, route, listener);
		} else {
			that.routes.fixed[verb][route] = listener;
		}
	}

	// Validate the parameters and add the routes
	if (typeof verb === 'string' && typeof listener === 'function') {

		// Set 'all' verb as default
		if (!/^(?:all|del|get|post|put)$/.test(verb)) {
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
Host.prototype.serve = function (directory, options, listener) {

	var that = this;

	// Validate the parameters and create the cache
	if (typeof directory === 'string') {

		// Make options parameter optional
		if (typeof options === 'function') {
			listener = options;
			options = null;
		}

		// Use options only as an object
		options = utils.assign({}, options);

		// Validate and set the listener for serving subdirectories
		if (typeof listener === 'function') {
			this.routes.serve = listener;
		} else {
			this.routes.serve = null;
		}

		// Destroy the existing cache
		if (this.cache) {
			this.cache.destroy();
		}

		// Create a new cache container
		this.cache = recache(directory, {
			dirs: options.dirs,
			files: options.files,
			persistent: false
		});

		// Trigger host error on cache errors
		this.cache.on('error', function (error) {
			utils.emitError(that, error);
		});
	}

	return this;
};

// WebSocket host factory
Host.prototype.ws = function (location, options, callback) {

	// Check for a valid location
	if (typeof location === 'string') {

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

	// Create the WebSocket host if it does not exist
	if (!this.routes.ws[location]) {
		this.routes.ws[location] = new utils.ws.host(this, location);
	}

	// Configure the WebSocket host and set the request listener
	this.routes.ws[location].config(options, callback);

	return this.routes.ws[location];
};

module.exports = Host;