'use strict';

var events = require('events'),
	HttpMixin = require('simples/lib/mixins/http-mixin'),
	recache = require('recache'),
	Route = require('simples/lib/route'),
	Store = require('simples/lib/store'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	WsHost = require('simples/lib/ws/host');

// HTTP host prototype constructor
var HttpHost = function (server, name) {

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
			value: HttpHost.defaultConfig(),
			writable: true
		},
		routes: {
			value: HttpHost.defaultRoutes(),
			writable: true
		},
		tengine: {
			value: null,
			writable: true
		}
	});

	// Add pattern property for dynamic hosts
	if (/\*/.test(name)) {
		Object.defineProperty(this, 'pattern', {
			value: RegExp('^' + name.replace(/\*/g, '.*?') + '$')
		});
	}

	// Create the host additional data container
	this.data = {};

	// Listen for triggered error routes
	this.on('estatus', function (code, connection) {
		if (this.routes.error[code]) {
			connection.status(code);
			this.routes.error[code].call(this, connection);
		}
	});
};

// Add a middleware to the host
HttpHost.addMiddleware = function (middleware) {

	var index = this.middlewares.indexOf(middleware);

	if (typeof middleware === 'function' && index < 0) {
		this.middlewares.push(middleware);
	}
};

// HTTP host factory function
HttpHost.create = function (server, name) {

	return new HttpHost(server, name);
};

// Generate a default configuration for HTTP hosts
HttpHost.defaultConfig = function () {

	return {
		compression: {
			enabled: false,
			// Regular expression for content type
			filter: /^.+$/,
			// https://nodejs.org/api/zlib.html#zlib_class_options
			options: null,
			// Preferred compression can be 'deflate' or 'gzip'
			preferred: 'deflate'
		},
		cors: {
			credentials: false,
			headers: [],
			methods: ['DELETE', 'GET', 'HEAD', 'POST', 'PUT'],
			origins: []
		},
		session: {
			enabled: false,
			store: Store.create()
		},
		timeout: 5000
	};
};

// Generate empty containers for routes
HttpHost.defaultRoutes = function () {

	return {
		dynamic: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {},
			ws: {}
		},
		error: {
			404: HttpMixin.notFound,
			405: HttpMixin.methodNotAllowed,
			500: HttpMixin.internalServerError
		},
		fixed: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {},
			ws: {}
		},
		serve: null
	};
};

// Get the listener or create a render listener from the provided view
HttpHost.getListener = function (listener, importer) {

	var view = listener;

	// Create a render listener in case there is a view defined as listener
	if (typeof view === 'string') {
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
	}

	return listener;
};

// Normalize route location
HttpHost.normalizeRoute = function (route) {

	// Get the pathname of the route
	route = url.parse(route.trim()).pathname;

	// Check for null route to stringify it
	if (route === null) {
		route = '';
	}

	// Remove leading slash
	if (route[0] === '/') {
		route = route.substr(1);
	}

	return route;
};

// Remove a middleware from the host
HttpHost.removeMiddleware = function (middleware) {

	var index = this.middlewares.indexOf(middleware);

	if (typeof middleware === 'function' && index >= 0) {
		this.middlewares.splice(index, 1);
	}
};

// Inherit from events.EventEmitter
HttpHost.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: HttpHost
	}
});

// Route all types of the requests
HttpHost.prototype.all = function (routes, listener, importer) {

	return this.route('all', routes, HttpHost.getListener(listener, importer));
};

// Set the configuration of the host
HttpHost.prototype.config = function (options) {

	// Accept only object as options
	if (typeof options === 'object') {

		// Use an empty object if options argument is null
		if (!options) {
			options = {};
		}

		// Set the compression options if available
		if (typeof options.compression === 'object') {
			utils.assign(this.options.compression, options.compression);
		}

		// Set the CORS options if available
		if (typeof options.cors === 'object') {
			utils.assign(this.options.cors, options.cors);
		}

		// Set the session options if available
		if (typeof options.session === 'object') {
			utils.assign(this.options.session, options.session);
		}

		// Set the timeout option if available
		if (typeof options.timeout === 'number') {
			this.options.timeout = options.timeout;
		}
	}

	return this;
};

// Route DELETE requests
HttpHost.prototype.del = function (routes, listener, importer) {

	return this.route('del', routes, HttpHost.getListener(listener, importer));
};

// Remove the host or clean the main host
HttpHost.prototype.destroy = function () {

	var routes = this.routes,
		server = this.server;

	// Destroy all fixed WebSocket hosts that are related to this HTTP host
	Object.keys(routes.fixed.ws).forEach(function (route) {
		routes.fixed.ws[route].destroy();
	});

	// Destroy all dynamic WebSocket hosts that are related to this HTTP host
	Object.keys(routes.dynamic.ws).forEach(function (route) {
		routes.dynamic.ws[route].destroy();
	});

	// Destroy static files cache if there is any
	if (this.cache) {
		this.cache.destroy();
		this.cache = null;
	}

	// Reset internal host properties
	this.middlewares.splice(0);
	this.options = HttpHost.defaultConfig();
	this.routes = HttpHost.defaultRoutes();
	this.tengine = null;

	// Do not delete the main host
	if (server !== this) {
		if (/\*/.test(this.name)) {
			delete server.hosts.dynamic[this.name];
		} else {
			delete server.hosts.fixed[this.name];
		}
	}
};

// Specify the template engine to render the responses
HttpHost.prototype.engine = function (engine) {

	// Validate template engine
	if (engine && engine.render) {
		this.tengine = engine;
	}

	return this;
};

// Route errors
HttpHost.prototype.error = function (code, listener, importer) {

	// Add the error listener
	if (typeof code === 'number') {
		this.routes.error[code] = HttpHost.getListener(listener, importer);
	}

	return this;
};

// Route GET requests
HttpHost.prototype.get = function (routes, listener, importer) {

	return this.route('get', routes, HttpHost.getListener(listener, importer));
};

// Remove the routes from the host
HttpHost.prototype.leave = function (verb, location) {

	var defaultRoutes = HttpHost.defaultRoutes(),
		that = this;

	// Remove one single route
	function removeRoute(route) {

		// Normalize route
		route = HttpHost.normalizeRoute(route);

		// Check for routes with named parameters
		if (/\:|\*/.test(route)) {
			delete that.routes.dynamic[verb][route];
		} else {
			delete that.routes.fixed[verb][route];
		}
	}

	// Check what to remove
	if (verb === 'error') {
		if (typeof routes === 'number' && this.routes.error[location]) {
			this.routes.error[location] = defaultRoutes.error[location];
		} else {
			this.routes.error = defaultRoutes.error;
		}
	} else if (Array.isArray(location)) {
		location.forEach(removeRoute);
	} else if (typeof location === 'string') {
		removeRoute(location);
	} else if (verb === 'serve') {

		// Destroy the existing cache container
		if (this.cache) {
			this.cache.destroy();
			this.cache = null;
		}

		// Remove the listener for the served static directory
		this.routes.serve = null;
	} else if (/^(?:all|del|get|post|put)$/.test(verb)) {
		this.routes.dynamic[verb] = defaultRoutes.dynamic[verb];
		this.routes.fixed[verb] = defaultRoutes.fixed[verb];
	} else {
		this.routes = defaultRoutes;
	}

	return this;
};

// Add or remove one or multiple middlewares
HttpHost.prototype.middleware = function (middlewares, remove) {

	// Check for array of middlewares
	if (Array.isArray(middlewares)) {
		if (remove === true) {
			middlewares.forEach(HttpHost.removeMiddleware.bind(this));
		} else {
			middlewares.forEach(HttpHost.addMiddleware.bind(this));
		}
	} else if (remove === true) {
		HttpHost.removeMiddleware.call(this, middlewares);
	} else {
		HttpHost.addMiddleware.call(this, middlewares);
	}

	return this;
};

// Route POST requests
HttpHost.prototype.post = function (routes, listener, importer) {

	return this.route('post', routes, HttpHost.getListener(listener, importer));
};

// Route PUT requests
HttpHost.prototype.put = function (routes, listener, importer) {

	return this.route('put', routes, HttpHost.getListener(listener, importer));
};

// Add all kinds of routes
HttpHost.prototype.route = function (verb, location, listener) {

	var dynamic = this.routes.dynamic,
		fixed = this.routes.fixed;

	// Add one single route
	function addRoute(location) {

		// Normalize route
		location = HttpHost.normalizeRoute(location);

		// Check for routes with named parameters
		if (/\:|\*/.test(location)) {
			dynamic[verb][location] = Route.create(location, listener);
		} else {
			fixed[verb][location] = Route.create(location, listener);
		}
	}

	// Validate the parameters and add the routes
	if (typeof verb === 'string' && typeof listener === 'function') {

		// Set 'all' verb as default
		if (!/^(?:all|del|get|post|put)$/.test(verb)) {
			verb = 'all';
		}

		// Add the routes to the host
		if (Array.isArray(location)) {
			location.forEach(addRoute);
		} else if (typeof location === 'string') {
			addRoute(location);
		}
	}

	return this;
};

// Route static files from a specific local directory
HttpHost.prototype.serve = function (directory, options, listener) {

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

		// Delegate cache events to the host
		this.cache.on('error', function (error) {
			utils.emitError(that, error);
		}).on('ready', function () {
			that.emit('serve');
		});
	}

	return this;
};

// Add one or multiple middlewares
HttpHost.prototype.use = function (middlewares) {
	return this.middleware(middlewares);
};

// Remove one or multiple middlewares
HttpHost.prototype.unuse = function (middlewares) {
	return this.middleware(middlewares, true);
};

// WS host factory
HttpHost.prototype.ws = function (location, options, listener) {

	var host = null,
		dynamic = this.routes.dynamic,
		fixed = this.routes.fixed;

	// Check for a valid location and normalize it
	if (typeof location === 'string') {
		location = HttpHost.normalizeRoute(location);
	} else {
		location = '';
	}

	// Check for dynamic WS host
	if (/\:|\*/.test(location)) {

		// Create the dynamic WS host if it does not exist
		if (!dynamic.ws[location]) {
			dynamic.ws[location] = WsHost.create(this, location, listener);
		}

		// Select th dynamic WS host
		host = dynamic.ws[location];
	} else {

		// Create the fixed WS host if it does not exist
		if (!fixed.ws[location]) {
			fixed.ws[location] = WsHost.create(this, location, listener);
		}

		// Select the fixed WS host
		host = fixed.ws[location];
	}

	return host.config(options, listener);
};

module.exports = HttpHost;