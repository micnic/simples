'use strict';

const Config = require('simples/lib/utils/config');
const Route = require('simples/lib/route');
const Store = require('simples/lib/store/store');
const WsHost = require('simples/lib/ws/host');

const { EventEmitter } = require('events');

const {
	availableCompressions,
	defaultCompression,
	httpTimeout,
	verbMethods
} = require('simples/lib/utils/constants');

const verbs = {
	all: 'all',
	delete: 'delete',
	get: 'get',
	patch: 'patch',
	post: 'post',
	put: 'put'
};

class HttpRouter extends EventEmitter {

	constructor(parent, location, options) {

		super();

		let host = null;

		// Get parent host and options from parent router
		if (parent) {
			host = parent._host;
			options = HttpRouter.optionsContainer(parent._options, options);
		} else {
			options = HttpRouter.optionsContainer(options);
		}

		// If no host is provided then current instance is the host
		if (!host) {
			host = this;
		}

		// Define router public properties
		this.data = {};

		// Define router private properties
		this._dynamic = HttpRouter.isDynamic(location);
		this._engine = null;
		this._errors = new Map();
		this._host = host;
		this._location = location;
		this._middlewares = new Set();
		this._options = options;
		this._parent = parent;

		// Add pattern property for dynamic router
		if (this._dynamic) {
			this._pattern = HttpRouter.getPattern(location);
		}
	}

	// Route all types of the requests
	all(location, listener, importer) {

		// Prepare the route listener
		listener = HttpRouter.getListener(listener, importer);

		// Set the route on the provided location
		HttpRouter.setRoute(this, verbs.all, location, listener);

		return this;
	}

	// Route DELETE requests
	delete(location, listener, importer) {

		// Prepare the route listener
		listener = HttpRouter.getListener(listener, importer);

		// Set the route on the provided location
		HttpRouter.setRoute(this, verbs.delete, location, listener);

		return this;
	}

	// Specify the template engine to render the responses
	engine(tengine) {

		// Validate template engine
		if (tengine && tengine.render) {
			this._engine = tengine;
		}

		return this;
	}

	// Route HTTP errors for 4xx and 5xx error codes
	error(code, listener, importer) {

		// Validate the code value
		if (HttpRouter.isValidErrorCode(code)) {

			// Prepare the route listener
			listener = HttpRouter.getListener(listener, importer);

			// Validate listener value to add it or remove the existing listener
			if (typeof listener === 'function') {
				this._errors.set(code, listener);
			}
		}

		return this;
	}

	// Route GET requests
	get(location, listener, importer) {

		// Prepare the route listener
		listener = HttpRouter.getListener(listener, importer);

		// Set the route on the provided location
		HttpRouter.setRoute(this, verbs.get, location, listener);

		return this;
	}

	// Route PATCH requests
	patch(location, listener, importer) {

		// Prepare the route listener
		listener = HttpRouter.getListener(listener, importer);

		// Set the route on the provided location
		HttpRouter.setRoute(this, verbs.patch, location, listener);

		return this;
	}

	// Route POST requests
	post(location, listener, importer) {

		// Prepare the route listener
		listener = HttpRouter.getListener(listener, importer);

		// Set the route on the provided location
		HttpRouter.setRoute(this, verbs.post, location, listener);

		return this;
	}

	// Route PUT requests
	put(location, listener, importer) {

		// Prepare the route listener
		listener = HttpRouter.getListener(listener, importer);

		// Set the route on the provided location
		HttpRouter.setRoute(this, verbs.put, location, listener);

		return this;
	}

	// Create a new router or return an existing one
	router(location, options) {

		// Check for valid router location
		if (typeof location === 'string' && location.length) {

			const routersContainer = this._host._routers;

			// Get the absolute location
			location = HttpRouter.getLocation(this._location, location);

			// Check for existing router or create a new one
			if (location === '/') {
				return this._host;
			} else if (routersContainer.fixed.has(location)) {
				return routersContainer.fixed.get(location);
			} else if (routersContainer.dynamic.has(location)) {
				return routersContainer.dynamic.get(location);
			} else {
				return HttpRouter.create(this._host, this, location, options);
			}
		} else {
			throw TypeError('"location" argument should be a non-empty string');
		}
	}

	// Add a middleware to the router
	use(middleware) {

		// Check if the middleware is a function and add it
		if (typeof middleware === 'function') {
			this._middlewares.add(middleware);
		}

		return this;
	}

	// WS host factory
	ws(location, options, listener) {

		const routes = this._host._routes.ws;

		let host = null;

		// Check for a valid arguments
		if (typeof location === 'string') {

			// Check for optional options and listener arguments
			if (typeof options === 'object') {

				// Nullify listener in case it is not a function
				if (typeof listener !== 'function') {
					listener = null;
				}
			} else if (typeof options === 'function') {
				listener = options;
				options = null;
			}

			// Normalize route location
			location = Route.normalizeLocation(location);

			// Merge router location with route location
			location = this._location + location;

			// Check for existing WS host or create a new one
			if (routes.fixed.has(location)) {
				host = routes.fixed.get(location);
			} else if (routes.dynamic.has(location)) {
				host = routes.dynamic.get(location);
			} else if (typeof listener === 'function') {
				host = WsHost.create(this._host, location, options, listener);
			}
		}

		return host;
	}

	// HTTP router factory method
	static create(host, parent, location, options) {

		const router = new HttpRouter(parent, location, options);
		const routers = host._routers;

		// Add the router to the routers container based on its type
		if (router._dynamic) {
			routers.dynamic.set(location, router);
		} else {
			routers.fixed.set(location, router);
		}

		return router;
	}

	// Get the listener or create a render listener from the provided view
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

	// Get the router location based on the provided locations
	static getLocation(absoluteLocation, relativeLocation) {

		// Remove leading slash and set trailing slash in relative location
		relativeLocation = relativeLocation.replace(/^\/*(.+?)\/*$/, '$1/');

		return (absoluteLocation + relativeLocation).replace(/\/+/g, '/');
	}

	// Get the pattern for the dynamic router
	static getPattern(routeLocation) {

		return RegExp(`^${routeLocation.replace(/\*/g, '.*?')}$`);
	}

	// Check for dynamic host name
	static isDynamic(nameValue) {

		return /\*/.test(nameValue);
	}

	// Check if the provided status code is a 4xx or 5xx error status code
	static isValidErrorCode(code) {

		return (typeof code === 'number' && /^(4|5)\d{2}$/.test(code));
	}

	// Set a route to the router
	static setRoute(router, verb, location, listener) {

		if (typeof location === 'string' && typeof listener === 'function') {

			// Normalize route location
			location = Route.normalizeLocation(location);

			// Merge router location with route location
			location = router._location + location;

			const parentHost = router._host;
			const route = Route.create(router, location, listener);

			// Check for dynamic route
			if (route.dynamic) {
				parentHost._routes.dynamic[verb].set(location, route);
			} else {
				parentHost._routes.fixed[verb].set(location, route);
			}
		}
	}

	// Create a sealed options object container
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
			compression: Config.getConfig({
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
			}, parentConfig.compression, config.compression),
			cors: Config.getConfig({
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
			}, parentConfig.cors, config.cors),
			logger: Config.getConfig({
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
			}, parentConfig.logger, config.logger),
			session: Config.getConfig({
				enabled: {
					type: Config.types.enable
				},
				store: {
					default: Store.create(),
					type: Config.types.object
				}
			}, parentConfig.session, config.session),
			static: Config.getConfig({
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
			}, parentConfig.static, config.static),
			timeout: Config.getNumberOption(config.timeout, httpTimeout)
		};
	}
}

module.exports = HttpRouter;