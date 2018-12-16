'use strict';

const Config = require('simples/lib/utils/config');
const domain = require('domain');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const fs = require('fs');
const HTTPConnection = require('simples/lib/http/connection');
const path = require('path');
const SessionUtils = require('simples/lib/utils/session-utils');

const {
	allowedHTTPMethods,
	internalServerErrorStatusCode,
	methodNotAllowedStatusCode,
	noContentStatusCode,
	notFoundStatusCode,
	notModifiedStatusCode,
	verbs
} = require('simples/lib/utils/constants');

const clientDir = path.join(__dirname, '../../dist');

class HTTPUtils {

	// Process HTTP requests
	static connectionListener(host, location, request, response) {

		const connectionDomain = domain.create();
		const pathname = location.pathname;
		const verb = verbs.get(request.method);

		let failed = false;
		let route = null;
		let routeListener = null;
		let router = host;

		// Check for a valid HTTP method
		if (request.method === 'OPTIONS') {
			routeListener = HTTPUtils.noContent;
		} else if (verb) {

			// Select the route
			route = HTTPUtils.getRoute(host._routes, verb, pathname);

			// Check for route to get the route listener and router
			if (route) {

				// Select the route listener
				routeListener = route.listener;

				// Select the route router if it is not the host
				if (route.router !== host) {
					router = route.router;
				}
			}
		}

		// If the route was not found try to find the router
		if (!route) {
			router = HTTPUtils.getRouter(host, location);
		}

		const connection = HTTPConnection.create(router, location, request, response);

		let middlewareIterator = router._middlewares.values();

		// Populate connection parameters for dynamic route
		if (route && route.dynamic) {
			pathname.match(route.pattern).slice(1).forEach((param, key) => {
				connection.params[route.keys[key]] = param;
			});
		}

		// Apply middlewares one by one and then apply the route
		const applyMiddlewares = () => {

			const iteration = middlewareIterator.next();

			// Check if the iteration is done
			if (iteration.done) {
				if (router._parent) {
					router = router._parent;
					middlewareIterator = router._middlewares.values();
					applyMiddlewares();
				} else {

					// Set the router keep alive timeout
					connection.keep(router._options.timeout);

					// Check for verb and available route listener to call it
					if (routeListener) {
						routeListener.call(router, connection);
					} else if (verb === 'get') {
						HTTPUtils.useStaticListener(connection);
					} else if (verb) {
						connection.error(notFoundStatusCode);
					} else {
						connection.header('Allow', allowedHTTPMethods);
						connection.error(methodNotAllowedStatusCode);
					}
				}
			} else {
				iteration.value(connection, applyMiddlewares);
			}
		};

		// Process the connection inside a domain
		connectionDomain.on('error', (error) => {

			// Emit safely the error to the host
			ErrorEmitter.emit(host, error);

			// Try to apply the route for error 500 or destroy the connection
			if (!connection._started && !failed) {

				// Set failed flag and provide the error to the connection data
				failed = true;
				connection.data.error = error;

				// Call the route for error 500, but still run it in the domain
				connectionDomain.run(() => {
					connection.error(internalServerErrorStatusCode);
				});
			} else {
				connection.destroy();
			}
		}).run(() => {

			const logger = router._options.logger;
			const session = router._options.session;

			// Check for enabled logger to log the connection
			if (Config.isEnabled(logger.enabled, connection)) {
				connection.log(logger.format, logger.log, logger.tokens);
			}

			// Check for enabled session to apply it
			if (Config.isEnabled(session.enabled, connection)) {
				HTTPUtils.applySession(connection).then(applyMiddlewares).catch((error) => {
					ErrorEmitter.emit(router, error);
				});
			} else {
				applyMiddlewares();
			}
		});
	}

	// Returns the dynamic route if found
	static getDynamicRoute(pathname, routesContainer) {

		// Loop through routes to find the one that match the location pattern
		for (const route of routesContainer.values()) {
			if (route.pattern.test(pathname)) {
				return route;
			}
		}

		return null;
	}

	// Returns the fixed or the dynamic route for the provided connection
	static getRoute(routesContainer, verb, pathname) {

		const fixed = routesContainer.fixed;

		let route = null;

		// Try to get the fixed or the dynamic route
		if (fixed[verb].has(pathname)) {
			route = fixed[verb].get(pathname);
		} else if (fixed.all.has(pathname)) {
			route = fixed.all.get(pathname);
		} else {

			const dynamic = routesContainer.dynamic;

			// Try to get the dynamic route using the provided verb
			route = HTTPUtils.getDynamicRoute(pathname, dynamic[verb]);

			// Try to get the dynamic route using the "all" verb
			if (!route) {
				route = HTTPUtils.getDynamicRoute(pathname, dynamic.all);
			}
		}

		return route;
	}

	// Get the router that matches the request location
	static getRouter(host, requestLocation) {

		// Loop through fixed routers to find the one that matches
		for (const [ currentLocation ] of host._routers.fixed) {
			if (requestLocation.startsWith(currentLocation)) {
				return host._routers.fixed.get(currentLocation);
			}
		}

		// Loop through dynamic routers to find the one that matches
		for (const [ currentLocation ] of host._routers.dynamic) {
			if (requestLocation.startsWith(currentLocation)) {
				return host._routers.fixed.get(currentLocation);
			}
		}

		return host;
	}

	// Serve static file
	static serveStatic(router, connection, location) {
		fs.stat(location, (error, stats) => {
			if (error) {
				connection.error(notFoundStatusCode);
			} else {

				const extension = path.extname(location).slice(1);
				const timestamp = stats.mtime.toUTCString();

				// Set the last modified time stamp
				connection.header('Last-Modified', timestamp);

				// Set the content type for files
				if (extension) {
					connection.type(extension);
				}

				if (stats.isDirectory()) {
					if (router._options.static.index.length) {

						let index = 0;

						const checkStaticLocation = (error) => {

							if (index < router._options.static.index.length) {

								const local = path.join(location, router._options.static.index[index]);

								index++;

								fs.stat(local, (error, stats) => {
									if (error) {
										checkStaticLocation();
									} else if (stats.isDirectory()) {
										checkStaticLocation();
									} else {
										HTTPUtils.serveStatic(router, connection, local);
									}
								});
							} else {
								connection.error(notFoundStatusCode);
							}
						};

						checkStaticLocation();
					} else {
						connection.error(notFoundStatusCode);
					}
				} else {

					// Check file timestamp to call "Not Modified" if it is the case
					if (connection.headers['if-modified-since'] === timestamp) {
						HTTPUtils.notModified.call(router, connection);
					} else {
						fs.ReadStream(location).pipe(connection);
					}
				}
			}
		});
	}

	// Returns the route to the static files and directories
	static useStaticListener(connection) {

		const connectionPath = connection.path;
		const router = connection._router;

		// Get the static element
		if (/^\/simples(?:.esnext|.min)?\.js$/.test(connectionPath)) {
			HTTPUtils.serveStatic(router, connection, path.join(clientDir, connectionPath.slice(1)));
		} else if (router._options.static.enabled) {
			HTTPUtils.serveStatic(router, connection, path.join(router._options.static.location, connectionPath));
		} else {
			connection.error(notFoundStatusCode);
		}
	}

	// Default route for "Internal Server Error" (500 error)
	static internalServerError(connection) {
		connection.end(`"${connection.url.path}" Internal Server Error`);
	}

	// Default route for "Method Not Allowed" (405 error)
	static methodNotAllowed(connection) {
		connection.end(`"${connection.method}" Method Not Allowed`);
	}

	// Route to set HTTP status code to 204 and close the connection
	static noContent(connection) {
		connection.status(noContentStatusCode).end();
	}

	// Default route for "Not Found" (404 error)
	static notFound(connection) {
		connection.end(`"${connection.url.path}" Not Found`);
	}

	// Route to set HTTP status code to 304 and close the connection
	static notModified(connection) {
		connection.status(notModifiedStatusCode).end();
	}

	// Set the session cookies for HTTP connections
	static applySession(connection) {

		return SessionUtils.getSession(connection).then((session) => {

			const router = connection._router;
			const sessionOptions = {};

			// Prepare cookies options
			sessionOptions.expires = router._options.session.timeout;
			sessionOptions.path = '/';
			sessionOptions.httpOnly = true;

			// Write the session cookies
			connection.cookie('_session', session.id, sessionOptions);
			connection.cookie('_hash', session.hash, sessionOptions);

			// Link the session container to the connection
			connection.session = session.container;

			// Write the session to the store and remove its reference
			connection.on('finish', () => {
				SessionUtils.applySession(connection, session);
			});
		});
	}
}

module.exports = HTTPUtils;