'use strict';

const { EventEmitter } = require('events');
const { join } = require('path');
const Route = require('simples/lib/route');
const Store = require('simples/lib/session/store');
const { getConfig, setConfig, types } = require('simples/lib/utils/config');
const {
	escapeRegExpString,
	isDynamic
} = require('simples/lib/utils/route-utils');
const WSHost = require('simples/lib/ws/host');

const compressionsSet = new Set(['deflate', 'gzip']); // Supported compressions
const defaultCompression = 'deflate'; // Default compression used by routers
const defaultSessionTimeout = 3600000; // Default timeout for session, one hour
const errorCodeRex = /^(4|5)\d{2}$/; // Regular expression for matching error
const matchStart = '^'; // Match start for regular expressions
const paramRex = /:[^\\/]+/g; // Regular expression for matching url parameters
const paramReplace = '([^/]+)'; // Replace for url parameters
const rootLocation = '/'; // Location for main router
const wildcardRex = /\*/g; // Regular expression for matching wildcards
const wildcardReplace = '[^/]+'; // Replace for wildcards

// Default list of files served as indexes in static files directories
const defaultStaticIndex = ['index.html'];

// Default directory location for static files
const defaultStaticLocation = join(process.cwd(), 'public');

const verbs = {
	all: 'all',
	delete: 'delete',
	get: 'get',
	patch: 'patch',
	post: 'post',
	put: 'put'
};

const verbMethods = [
	'DELETE',
	'GET',
	'HEAD',
	'PATCH',
	'POST',
	'PUT'
]; // Supported verb methods

const configAction = {
	compression(router, config) {
		router.compression(config);
	},
	cors(router, config) {
		router.cors(config);
	},
	logger(router, config) {
		router.logger(config);
	},
	session(router, config) {
		router.session(config);
	},
	static(router, config) {
		router.static(config);
	},
	timeout(router, config) {
		router.timeout(config);
	}
};

const compressionSchema = {
	enabled: {
		type: types.enable
	},
	options: {
		type: types.object
	},
	preferred: {
		default: defaultCompression,
		set: compressionsSet,
		type: types.set
	}
};

const corsSchema = {
	credentials: {
		type: types.boolean
	},
	headers: {
		default: [],
		type: types.array
	},
	methods: {
		default: verbMethods,
		type: types.array
	},
	origins: {
		default: [],
		type: types.array
	}
};

const loggerSchema = {
	enabled: {
		type: types.enable
	},
	format: {
		type: types.string
	},
	log: {
		type: types.function
	},
	tokens: {
		type: types.function
	}
};

const sessionSchema = {
	enabled: {
		type: types.enable
	},
	store: {
		default: Store,
		type: types.object
	},
	timeout: {
		default: defaultSessionTimeout,
		type: types.number
	}
};

const staticSchema = {
	enabled: {
		type: types.enable
	},
	index: {
		default: defaultStaticIndex,
		type: types.array
	},
	location: {
		default: defaultStaticLocation,
		type: types.string
	}
};

const timeoutSchema = {
	enabled: {
		type: types.enable
	},
	value: {
		type: types.number
	}
};

const { assign, create, keys } = Object;

class Router extends EventEmitter {

	/**
	 * Router constructor
	 * @param {Router} parent
	 * @param {string} location
	 */
	constructor(parent, location) {

		super();

		let host = this;
		let path = location;

		// Define router public properties
		this.data = {};

		// Check for parent to create options container
		if (parent) {
			host = parent._host;
			this._options = create(parent._options);
		} else {
			path = rootLocation;
			this._options = create({
				compression: create(getConfig(compressionSchema)),
				cors: create(getConfig(corsSchema)),
				logger: create(getConfig(loggerSchema)),
				session: create(getConfig(sessionSchema)),
				static: create(getConfig(staticSchema)),
				timeout: create(getConfig(timeoutSchema))
			});
		}

		const pattern = escapeRegExpString(path)
			.replace(wildcardRex, wildcardReplace)
			.replace(paramRex, paramReplace);

		// Set router location pattern
		this._pattern = RegExp(matchStart + pattern);

		// Define router private properties
		this._engine = null;
		this._errors = new Map();
		this._host = host;
		this._location = path;
		this._middlewares = new Set();
		this._parent = parent;
	}

	/**
	 * Route all types of requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	all(route, listener, importer) {

		// Prepare the route listener
		const callback = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.all, route, callback);

		return this;
	}

	/**
	 * Configure router compression options
	 * @param {string|Enabled} preferred
	 * @param {RouterCompressionOptions} config
	 * @returns {this}
	 */
	compression(preferred, config) {

		const source = {};

		// Check for optional preferred argument
		if (typeof preferred === 'boolean' || typeof preferred === 'function') {
			assign(source, config);
			source.enabled = preferred;
		} else if (compressionsSet.has(preferred)) {
			assign(source, config);
			source.enabled = true;
			source.preferred = preferred;
		} else if (typeof preferred === 'object') {
			assign(source, preferred);
		}

		// Set compression options
		setConfig(compressionSchema, this._options.compression, source);

		return this;
	}

	/**
	 * Set all router options
	 * @param {RouterOptions} options
	 */
	config(options) {

		// Check for provided options to be an object
		if (options && typeof options === 'object') {
			keys(options).forEach((key) => {
				if (configAction[key]) {
					configAction[key](this, options[key]);
				}
			});
		}

		return this;
	}

	/**
	 * Configure router CORS options
	 * @param {RouterCORSOptions} config
	 * @returns {this}
	 */
	cors(config) {

		// Set CORS options
		setConfig(corsSchema, this._options.cors, config);

		return this;
	}

	/**
	 * Route DELETE requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	delete(route, listener, importer) {

		// Prepare the route listener
		const callback = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.delete, route, callback);

		return this;
	}

	/**
	 * Define the template engine to render the responses
	 * @param {TemplateEngine} engine
	 * @returns {this}
	 */
	engine(engine) {

		// Validate template engine
		if (engine && engine.render) {
			this._engine = engine;
		}

		return this;
	}

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 * @param {number} code
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	error(code, listener, importer) {

		// Validate the code value
		if (Router.isValidErrorCode(code)) {

			// Prepare the route listener
			const callback = Router.getListener(listener, importer);

			// Validate listener value to add it or remove the existing listener
			if (typeof callback === 'function') {
				this._errors.set(code, callback);
			}
		}

		return this;
	}

	/**
	 * Route GET requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	get(route, listener, importer) {

		// Prepare the route listener
		const callback = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.get, route, callback);

		return this;
	}

	/**
	 * Configure router logger options
	 * @param {RouterLoggerOptions} config
	 * @returns {this}
	 */
	logger(config) {

		// Set logger options
		setConfig(loggerSchema, this._options.logger, config);

		return this;
	}

	/**
	 * Route PATCH requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	patch(route, listener, importer) {

		// Prepare the route listener
		const callback = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.patch, route, callback);

		return this;
	}

	/**
	 * Route POST requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	post(route, listener, importer) {

		// Prepare the route listener
		const callback = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.post, route, callback);

		return this;
	}

	/**
	 * Route PUT requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {this}
	 */
	put(route, listener, importer) {

		// Prepare the route listener
		const callback = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.put, route, callback);

		return this;
	}

	/**
	 * Create a new router
	 * @param {string} location
	 * @returns {this}
	 */
	router(location) {

		// Get the absolute location
		if (typeof location === 'string') {

			const path = Router.getLocation(this._location, location);
			const router = new Router(this, path);
			const routers = this._host._routers;

			// Add the router to the host's routers container based on its type
			if (isDynamic(path)) {
				routers.dynamic.set(path, router);
			} else {
				routers.fixed.set(path, router);
			}

			return router;
		}

		return null;
	}

	/**
	 * Configure router session options
	 * @param {RouterSessionOptions} config
	 * @returns {this}
	 */
	session(config) {

		// Set session options
		setConfig(sessionSchema, this._options.session, config);

		return this;
	}

	/**
	 * Configure router static files options
	 * @param {string|Enabled} location
	 * @param {RouterStaticOptions} config
	 * @returns {this}
	 */
	static(location, config) {

		const source = {};

		// Check for optional location argument
		if (typeof location === 'boolean' || typeof location === 'function') {
			assign(source, config);
			source.enabled = location;
		} else if (typeof location === 'string') {
			assign(source, config);
			source.enabled = true;
			source.location = location;
		} else if (typeof location === 'object') {
			assign(source, location);
		}

		// Set static files options
		setConfig(staticSchema, this._options.static, source);

		return this;
	}

	/**
	 * Configure router HTTP timeout
	 * @param {RouterTimeoutOptions} config
	 * @returns {this}
	 */
	timeout(config) {

		// Set timeout options
		setConfig(timeoutSchema, this._options.timeout, config);

		return this;
	}

	/**
	 * Add a middleware to the router
	 * @param {Middleware} middleware
	 * @returns {this}
	 */
	use(middleware) {

		// Check if the middleware is a function and add it
		if (typeof middleware === 'function') {
			this._middlewares.add(middleware);
		}

		return this;
	}

	/**
	 * Set a new WS host
	 * @param {string} location
	 * @param {WSOptions} options
	 * @param {WSListener} listener
	 * @returns {WSHost}
	 */
	ws(location, options, listener) {

		// Check for a valid arguments
		if (typeof location === 'string') {

			let config = options;
			let callback = listener;

			// Make options argument optional
			if (typeof config === 'function') {
				callback = config;
				config = null;
			}

			// Merge router location with route location
			const path = this._location + Route.normalizeLocation(location);

			// Create a new WS host
			if (typeof callback === 'function') {
				return new WSHost(this, path, config, callback);
			}
		}

		return null;
	}

	/**
	 * Get the listener or create a render listener from the provided view
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {RouteListener}
	 */
	static getListener(listener, importer) {

		// Create a render listener in case there is a view defined as listener
		if (typeof listener === 'string') {

			const view = listener;

			// Prepare the listener based on the importer parameter
			if (typeof importer === 'function') {
				return (connection) => {
					importer(connection, (data) => {
						connection.render(view, data);
					});
				};
			}

			return (connection) => {
				connection.render(view, importer);
			};
		}

		return listener;
	}

	/**
	 * Get the router location based on the provided locations
	 * @param {string} absoluteLocation
	 * @param {string} relativeLocation
	 * @returns {string}
	 */
	static getLocation(absoluteLocation, relativeLocation) {

		// Remove leading slash and set trailing slash in relative location
		const path = relativeLocation.replace(/^\/*(.+?)\/*$/, '$1/');

		return (absoluteLocation + path).replace(/\/+/g, '/');
	}

	/**
	 * Get the pattern for the dynamic router
	 * @param {string} routeLocation
	 * @returns {RegExp}
	 */
	static getPattern(routeLocation) {

		return RegExp(`^${routeLocation.replace(/\*/g, '.*?')}$`);
	}

	/**
	 * Check if the provided status code is a 4xx or 5xx error status code
	 * @param {number} code
	 * @returns {boolean}
	 */
	static isValidErrorCode(code) {

		return (typeof code === 'number' && errorCodeRex.test(code));
	}

	/**
	 * Set a route to the router
	 * @param {Router} router
	 * @param {string} verb
	 * @param {string} location
	 * @param {RouteListener} listener
	 * @returns {void}
	 */
	static setRoute(router, verb, location, listener) {

		if (typeof location === 'string' && typeof listener === 'function') {

			const host = router._host;
			const path = router._location + Route.normalizeLocation(location);
			const route = new Route(router, path, listener);

			// Check for dynamic route
			if (route.dynamic) {
				host._routes.dynamic[verb].set(path, route);
			} else {
				host._routes.fixed[verb].set(path, route);
			}
		}
	}
}

module.exports = Router;