'use strict';

const { EventEmitter } = require('events');
const Route = require('simples/lib/route');
const Store = require('simples/lib/session/store');
const Config = require('simples/lib/utils/config');
const RouteUtils = require('simples/lib/utils/route-utils');
const WSHost = require('simples/lib/ws/host');

const compressionsSet = new Set(['deflate', 'gzip']); // Supported compressions
const defaultCompression = 'deflate'; // Default compression used by routers
const defaultSessionTimeout = 3600000; // Default timeout for session, one hour

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

class Router extends EventEmitter {

	/**
	 * Router constructor
	 * @param {Router} parent
	 * @param {string} location
	 * @param {RouterOptions} options
	 */
	constructor(parent, location, options) {

		super();

		let host = this;
		let path = location;

		// Get parent host and options from parent router
		if (parent) {
			host = parent._host;
			Router.setOptions(this, parent._options, options);
		} else {
			path = '/';
			Router.setOptions(this, options);
		}

		if (RouteUtils.isDynamic(path)) {

			let pattern = RouteUtils.escapeRegExpString(path);

			// Replace "*" with any match
			pattern = pattern.replace(/\*/g, '.*?');

			// Prepare dynamic parameters match
			pattern = pattern.replace(/:[^\\/]+/g, '([^\\/]+)');

			// Set host name pattern
			this._pattern = RegExp(`^${pattern}`);
		}

		// Define router public properties
		this.data = {};

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
	 * @param {RouterCompressionOptions} config
	 * @returns {this}
	 */
	compression(config) {

		const options = this._options;
		const { compression } = options;

		// Set compression options
		options.compression = Router.getCompression(compression, config);

		return this;
	}

	/**
	 * Configure router CORS options
	 * @param {RouterCORSOptions} config
	 * @returns {this}
	 */
	cors(config) {

		const options = this._options;

		// Set CORS options
		options.cors = Router.getCORS(options.cors, config);

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

		const options = this._options;

		// Set logger options
		options.logger = Router.getLogger(options.logger, config);

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
	 * @param {RouterOptions} options
	 * @returns {this}
	 */
	router(location, options) {

		// Get the absolute location
		if (typeof location === 'string') {

			const path = Router.getLocation(this._location, location);
			const router = new Router(this, path, options);
			const routers = this._host._routers;

			// Add the router to the host's routers container based on its type
			if (RouteUtils.isDynamic(path)) {
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

		const options = this._options;

		// Set session options
		options.session = Router.getSession(options.session, config);

		return this;
	}

	/**
	 * Configure router static files options
	 * @param {RouterStaticOptions} config
	 * @returns {this}
	 */
	static(config) {

		const options = this._options;

		// Set static files options
		options.static = Router.getStatic(options.static, config);

		return this;
	}

	/**
	 * Configure router HTTP timeout
	 * @param {RouterTimeoutOptions} config
	 * @returns {this}
	 */
	timeout(config) {

		const options = this._options;

		// Set timeout options
		options.timeout = Router.getTimeout(options.timeout, config);

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
	 * Create a compression options container
	 * @param {RouterCompressionOptions} parentConfig
	 * @param {RouterCompressionOptions} config
	 * @returns {RouterCompressionOptions}
	 */
	static getCompression(parentConfig, config) {

		return Config.getConfig({
			enabled: {
				type: Config.types.enable
			},
			options: {
				type: Config.types.object
			},
			preferred: {
				default: defaultCompression,
				set: compressionsSet,
				type: Config.types.set
			}
		}, parentConfig, config);
	}

	/**
	 * Create a CORS options container
	 * @param {RouterCORSOptions} parentConfig
	 * @param {RouterCORSOptions} config
	 * @returns {RouterCORSOptions}
	 */
	static getCORS(parentConfig, config) {

		return Config.getConfig({
			credentials: {
				type: Config.types.boolean
			},
			headers: {
				default: [],
				type: Config.types.array
			},
			methods: {
				default: verbMethods,
				type: Config.types.array
			},
			origins: {
				default: [],
				type: Config.types.array
			}
		}, parentConfig, config);
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
	 * Create a logger options container
	 * @param {RouterLoggerOptions} parentConfig
	 * @param {RouterLoggerOptions} config
	 * @returns {RouterLoggerOptions}
	 */
	static getLogger(parentConfig, config) {

		return Config.getConfig({
			enabled: {
				type: Config.types.enable
			},
			format: {
				type: Config.types.string
			},
			log: {
				type: Config.types.function
			},
			tokens: {
				type: Config.types.function
			}
		}, parentConfig, config);
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
	 * Create a session options container
	 * @param {RouterSessionOptions} parentConfig
	 * @param {RouterSessionOptions} config
	 * @returns {RouterSessionOptions}
	 */
	static getSession(parentConfig, config) {

		return Config.getConfig({
			enabled: {
				type: Config.types.enable
			},
			store: {
				default: new Store(),
				type: Config.types.object
			},
			timeout: {
				default: defaultSessionTimeout,
				type: Config.types.number
			}
		}, parentConfig, config);
	}

	/**
	 * Create a static files options container
	 * @param {RouterStaticOptions} parentConfig
	 * @param {RouterStaticOptions} config
	 * @returns {RouterStaticOptions}
	 */
	static getStatic(parentConfig, config) {

		return Config.getConfig({
			enabled: {
				type: Config.types.enable
			},
			index: {
				default: ['index.html'],
				type: Config.types.array
			},
			location: {
				type: Config.types.string
			}
		}, parentConfig, config);
	}

	/**
	 * Create a connection timeout options container
	 * @param {RouterTimeoutOptions} parentConfig
	 * @param {RouterTimeoutOptions} config
	 * @returns {RouterTimeoutOptions}
	 */
	static getTimeout(parentConfig, config) {

		return Config.getConfig({
			enabled: {
				type: Config.types.enable
			},
			value: {
				type: Config.types.number
			}
		}, parentConfig, config);
	}

	/**
	 * Check if the provided status code is a 4xx or 5xx error status code
	 * @param {number} code
	 * @returns {boolean}
	 */
	static isValidErrorCode(code) {

		return (typeof code === 'number' && /^(4|5)\d{2}$/.test(code));
	}

	/**
	 * Create a Router options container
	 * @param {RouterOptions} parentConfig
	 * @param {RouterOptions} config
	 * @returns {RouterOptions}
	 */
	static optionsContainer(parentConfig, config) {

		// Create an empty parent config if it is not available
		if (!parentConfig) {
			parentConfig = {};
		}

		// Create an empty config if it is not available
		if (!config) {
			config = {};
		}

		return {
			compression: Router.getCompression(parentConfig.compression, config.compression),
			cors: Router.getCORS(parentConfig.cors, config.cors),
			logger: Router.getLogger(parentConfig.logger, config.logger),
			session: Router.getSession(parentConfig.session, config.session),
			static: Router.getStatic(parentConfig.static, config.static),
			timeout: Router.getTimeout(parentConfig.timeout, config.timeout)
		};
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

	/**
	 * Merge router options with parent options and save them
	 * @param {Router} router
	 * @param {RouterOptions} parentOptions
	 * @param {RouterOptions} options
	 */
	static setOptions(router, parentOptions, options) {

		router._options = Router.optionsContainer(parentOptions, options);
	}
}

module.exports = Router;