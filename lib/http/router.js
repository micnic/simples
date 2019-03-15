'use strict';

const Config = require('simples/lib/utils/config');
const Route = require('simples/lib/route');
const RouteUtils = require('simples/lib/utils/route-utils');
const Store = require('simples/lib/store/store');
const WSHost = require('simples/lib/ws/host');

const { EventEmitter } = require('events');

const {
	verbMethods
} = require('simples/lib/utils/constants');

const availableCompressions = new Set(['deflate', 'gzip']); // Supported compressions
const defaultCompression = 'deflate'; // Default compression used by routers
const defaultSessionTimeout = 3600; // Default timeout for session

const verbs = {
	all: 'all',
	delete: 'delete',
	get: 'get',
	patch: 'patch',
	post: 'post',
	put: 'put'
};

class Router extends EventEmitter {

	/**
	 * Router constructor
	 * @param {Router} parent
	 * @param {string} location
	 * @param {RouterOptions} options
	 */
	constructor(parent, location, options) {

		super();

		let host = null;

		// Get parent host and options from parent router
		if (parent) {
			host = parent._host;
			Router.setOptions(this, parent._options, options);
		} else {
			host = this;
			location = '/';
			Router.setOptions(this, options);
		}

		if (RouteUtils.isDynamic(location)) {

			let pattern = RouteUtils.escapeRegExpString(location);

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
		this._location = location;
		this._middlewares = new Set();
		this._parent = parent;
	}

	/**
	 * Route all types of requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {Router}
	 */
	all(route, listener, importer) {

		// Prepare the route listener
		listener = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.all, route, listener);

		return this;
	}

	/**
	 * Configure router compression options
	 * @param {RouterCompressionOptions} config
	 * @returns {Router}
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
	 * @returns {Router}
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
	 * @returns {Router}
	 */
	delete(route, listener, importer) {

		// Prepare the route listener
		listener = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.delete, route, listener);

		return this;
	}

	/**
	 * Define the template engine to render the responses
	 * @param {TemplateEngine} engine
	 * @returns {Router}
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
	 * @returns {Router}
	 */
	error(code, listener, importer) {

		// Validate the code value
		if (Router.isValidErrorCode(code)) {

			// Prepare the route listener
			listener = Router.getListener(listener, importer);

			// Validate listener value to add it or remove the existing listener
			if (typeof listener === 'function') {
				this._errors.set(code, listener);
			}
		}

		return this;
	}

	/**
	 * Route GET requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {Router}
	 */
	get(route, listener, importer) {

		// Prepare the route listener
		listener = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.get, route, listener);

		return this;
	}

	/**
	 * Configure router logger options
	 * @param {RouterLoggerOptions} config
	 * @returns {Router}
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
	 * @returns {Router}
	 */
	patch(route, listener, importer) {

		// Prepare the route listener
		listener = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.patch, route, listener);

		return this;
	}

	/**
	 * Route POST requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {Router}
	 */
	post(route, listener, importer) {

		// Prepare the route listener
		listener = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.post, route, listener);

		return this;
	}

	/**
	 * Route PUT requests
	 * @param {string} route
	 * @param {RouteListener} listener
	 * @param {DataImporter} importer
	 * @returns {Router}
	 */
	put(route, listener, importer) {

		// Prepare the route listener
		listener = Router.getListener(listener, importer);

		// Set the route on the provided location
		Router.setRoute(this, verbs.put, route, listener);

		return this;
	}

	/**
	 * Create a new router
	 * @param {string} location
	 * @param {RouterOptions} options
	 * @returns {Router}
	 */
	router(location, options) {

		// Get the absolute location
		if (typeof location === 'string') {

			const host = this._host;
			const routers = host._routers;

			// Get the absolute location
			location = Router.getLocation(this._location, location);

			const router = new Router(this, location, options);

			// Add the router to the host's routers container based on its type
			if (RouteUtils.isDynamic(location)) {
				routers.dynamic.set(location, router);
			} else {
				routers.fixed.set(location, router);
			}

			return router;
		} else {
			return null;
		}
	}

	/**
	 * Configure router session options
	 * @param {RouterSessionOptions} config
	 * @returns {Router}
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
	 * @returns {Router}
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
	 * @returns {Router}
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
	 * @returns {Router}
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

			// Make options argument optional
			if (typeof options === 'function') {
				listener = options;
				options = null;
			}

			// Normalize route location
			location = Route.normalizeLocation(location);

			// Merge router location with route location
			location = this._location + location;

			// Create a new WS host
			if (typeof listener === 'function') {
				return new WSHost(this, location, options, listener);
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
				set: availableCompressions,
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
				listener = (connection) => {
					importer(connection, (data) => {
						connection.render(view, data);
					});
				};
			} else {
				listener = (connection) => {
					connection.render(view, importer);
				};
			}
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
		relativeLocation = relativeLocation.replace(/^\/*(.+?)\/*$/, '$1/');

		return (absoluteLocation + relativeLocation).replace(/\/+/g, '/');
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
	 * Create a sealed options object container
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

			// Normalize route location
			location = Route.normalizeLocation(location);

			// Merge router location with route location
			location = router._location + location;

			const host = router._host;
			const route = new Route(router, location, listener);

			// Check for dynamic route
			if (route.dynamic) {
				host._routes.dynamic[verb].set(location, route);
			} else {
				host._routes.fixed[verb].set(location, route);
			}
		}
	}

	static setOptions(router, parentOptions, options) {

		router._options = Router.optionsContainer(parentOptions, options);
	}
}

module.exports = Router;