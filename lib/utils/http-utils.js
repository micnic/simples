'use strict';

const { ReadStream, stat } = require('fs');
const { extname, join } = require('path');
const HTTPConnection = require('simples/lib/http/connection');
const Session = require('simples/lib/session/session');
const Config = require('simples/lib/utils/config');
const ErrorEmitter = require('simples/lib/utils/error-emitter');

const internalServerErrorStatusCode = 500; // Status code for error 500 response
const methodNotAllowedStatusCode = 405; // Status code for error 405 response
const noContentStatusCode = 204; // Status code for message 204 response
const notFoundStatusCode = 404; // Status code for error 404 response
const notModifiedStatusCode = 304; // Status code for message 304 response

const verbs = new Map(); // Supported REST verbs

// Add the supported REST verbs
verbs.set('DELETE', 'del');
verbs.set('GET', 'get');
verbs.set('HEAD', 'get');
verbs.set('PATCH', 'patch');
verbs.set('POST', 'post');
verbs.set('PUT', 'put');

const verbMethods = Array.from(verbs.keys()); // Supported verb methods
const allowedHTTPMethods = verbMethods.join(','); // String join of http methods

/**
 * Apply router middlewares
 * @param {HTTPConnection} connection
 * @returns {Promise<void>}
 */
const applyMiddlewares = (connection) => {

	let router = connection._router;

	// Skip any intermediate router that do not have middlewares
	while (router._parent && router._middlewares.size === 0) {
		router = router._parent;
	}

	// In case of main router and no middlewares end process
	if (!router._parent && router._middlewares.size === 0) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {

		let iterator = router._middlewares.values();

		const next = (error) => {

			const iteration = iterator.next();

			// Check for any error or continue iteration
			if (error) {
				reject(error);
			} else if (iteration.done) {
				if (router._parent) {

					// Select parent router
					router = router._parent;

					// Skip any intermediate router that do not have middlewares
					while (router._parent && router._middlewares.size === 0) {
						router = router._parent;
					}

					// In case of main router and no middlewares end process
					if (!router._parent && router._middlewares.size === 0) {
						resolve();
					} else {
						iterator = router._middlewares.values();
						next();
					}
				} else {
					resolve();
				}
			} else {
				try {
					iteration.value(connection, next);
				} catch (exception) {
					reject(exception);
				}
			}
		};

		// Start iteration
		next();
	});
};

/**
 * Set the session cookies for HTTP connections
 * @param {HTTPConnection} connection
 * @returns {Promise<void>}
 */
const applySession = async (connection) => {

	const id = connection.cookies._session;
	const { store, timeout } = connection._router._options.session;
	const session = await Session.for(connection, store, id, timeout);

	// Write the session cookies
	connection.cookie('_session', session.id, {
		expires: session.timeout,
		httpOnly: true,
		path: '/'
	});

	return Promise.resolve();
};

/**
 * Handle any possible errors
 * @param {HTTPConnection} connection
 * @param {Error} error
 */
const errorListener = (connection, error) => {

	// Emit safely the error to the host
	ErrorEmitter.emit(connection._router, error);

	// Try to apply the route for error 500 or destroy the connection
	if (!connection._started && !connection._failed) {

		// Set failed flag and provide the error to the connection data
		connection._failed = true;
		connection.data.error = error;

		// Handle the internal server error route
		try {
			connection.error(internalServerErrorStatusCode);
		} catch (exception) {
			errorListener(connection, exception);
		}
	} else {
		connection.destroy();
	}
};

/**
 * Returns the dynamic route if found
 * @param {*} routes
 * @param {string} verb
 * @param {string} pathname
 * @returns {Route}
 */
const getDynamicRoute = (routes, verb, pathname) => {

	// Loop through routes to find the one that match the location pattern
	if (routes[verb].size > 0) {
		for (const route of routes[verb].values()) {
			if (route.pattern.test(pathname)) {
				return route;
			}
		}
	}

	// Loop through routes to find the one that match the location pattern
	if (routes.all.size > 0) {
		for (const route of routes.all.values()) {
			if (route.pattern.test(pathname)) {
				return route;
			}
		}
	}

	return null;
};

/**
 * Returns the fixed or the dynamic route for the provided connection
 * @param {*} routes
 * @param {string} verb
 * @param {string} pathname
 * @returns {Route}
 */
const getRoute = (routes, verb, pathname) => {

	// Check for verb
	if (verb) {

		const { dynamic, fixed } = routes;

		// Try to get the fixed or the dynamic route
		if (fixed[verb].has(pathname)) {
			return fixed[verb].get(pathname);
		} else if (fixed.all.has(pathname)) {
			return fixed.all.get(pathname);
		}

		// Try to get the dynamic route using the provided verb
		return getDynamicRoute(dynamic, verb, pathname);
	}

	return null;
};

/**
 * Get the router that matches the request location
 * @param {HTTPHost} host
 * @param {Route} route
 * @param {string} location
 * @returns {Router}
 */
const getRouter = (host, route, location) => {

	// If route is provided just get its router
	if (route) {
		return route.router;
	}

	// Loop through fixed routers to find the one that matches
	if (host._routers.fixed.size > 0) {
		for (const [ routerLocation ] of host._routers.fixed) {
			if (location.startsWith(routerLocation)) {
				return host._routers.fixed.get(routerLocation);
			}
		}
	}

	// Loop through dynamic routers to find the one that matches
	if (host._routers.dynamic.size > 0) {
		for (const [ routerLocation, router ] of host._routers.dynamic) {
			if (router._pattern.test(location)) {
				return host._routers.dynamic.get(routerLocation);
			}
		}
	}

	return host;
};

/**
 * Route to set HTTP status code to 204 and close the connection
 * @param {HTTPConnection} connection
 */
const noContent = (connection) => {
	connection.status(noContentStatusCode).end();
};

/**
 * Route to set HTTP status code to 304 and close the connection
 * @param {HTTPConnection} connection
 */
const notModified = (connection) => {
	connection.status(notModifiedStatusCode).end();
};

/**
 * Serve a static file
 * @param {HTTPConnection} connection
 * @param {Stats} stats
 * @param {string} location
 */
const serveFile = (connection, stats, location) => {

	const extension = extname(location);
	const timestamp = stats.mtime.toUTCString();

	// Set the content type for files
	if (extension) {
		connection.type(extension);
	}

	// Set the last modified time stamp
	connection.header('Last-Modified', timestamp);

	// Check file timestamp to call "Not Modified" if it is the case
	if (connection.headers['if-modified-since'] === timestamp) {
		notModified.call(connection._router, connection);
	} else {
		// In Node 10+ use stream.pipeline()
		ReadStream(location).pipe(connection);
	}
};

/**
 * Serve a index file
 * @param {HTTPConnection} connection
 * @param {string} location
 * @param {number} index
 */
const serveIndexFile = (connection, location, index) => {

	const router = connection._router;

	if (index < router._options.static.index.length) {

		const local = join(location, router._options.static.index[index]);

		stat(local, (error, stats) => {
			if (stats.isFile()) {
				serveFile(connection, stats, local);
			} else {
				serveIndexFile(connection, location, index + 1);
			}
		});
	} else {
		connection.error(notFoundStatusCode);
	}
};

/**
 * Serve static file
 * @param {HTTPConnection} connection
 * @param {string} location
 */
const serveStatic = (connection, location) => {


	stat(location, (error, stats) => {
		if (error) {
			connection.error(notFoundStatusCode);
		} else {

			// Check for directory to serve index file
			if (stats.isDirectory()) {
				serveIndexFile(connection, location, 0);
			} else if (stats.isFile()) {
				serveFile(connection, stats, location);
			} else {
				connection.error(notFoundStatusCode);
			}
		}
	});
};

/**
 * Returns the route to the static files and directories
 * @param {HTTPConnection} connection
 */
const useStaticListener = (connection) => {

	const { _router: router, path } = connection;

	// Check if static files are enabled
	if (Config.isEnabled(router._options.static.enabled, connection)) {
		serveStatic(connection, join(router._options.static.location, path));
	} else {
		connection.error(notFoundStatusCode);
	}
};

/**
 * Handle route
 * @param {HTTPConnection} connection
 * @param {Route} route
 */
const handleRoute = (connection, route) => {

	const { method } = connection.request;
	const verb = verbs.get(method);

	// Check for route to handle it
	if (route) {
		route.listener.call(connection._router, connection);
	} else if (verb === 'get') {
		useStaticListener(connection);
	} else if (verb) {
		connection.error(notFoundStatusCode);
	} else if (method === 'OPTIONS') {
		noContent.call(connection._router, connection);
	} else {
		connection.header('Allow', allowedHTTPMethods);
		connection.error(methodNotAllowedStatusCode);
	}
};

/**
 * Process HTTP requests
 * @param {HTTPHost} host
 * @param {URL} location
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 */
const httpRequestListener = async (host, location, request, response) => {

	const { pathname } = location;
	const verb = verbs.get(request.method);
	const route = getRoute(host._routes, verb, pathname);
	const router = getRouter(host, route, pathname);
	const { session } = router._options;
	const connection = new HTTPConnection(router, location, request, response);

	// Populate connection parameters for dynamic route
	if (route && route.dynamic) {
		pathname.match(route.pattern).slice(1).forEach((param, key) => {
			connection.params[route.keys[key]] = param;
		});
	}

	// Check for errors while the request is handled
	try {

		// Check for enabled session to apply it
		if (Config.isEnabled(session.enabled, connection)) {
			await applySession(connection);
		}

		// Apply middlewares and handle the route
		await applyMiddlewares(connection);
		await handleRoute(connection, route);
	} catch (error) {
		errorListener(connection, error);
	}
};

module.exports = {
	httpRequestListener
};