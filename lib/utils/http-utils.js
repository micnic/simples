'use strict';

const domain = require('domain');
const ErrorEmitter = require('simples/lib/utils/error-emitter');
const fs = require('fs');
const HttpConnection = require('simples/lib/http/connection');
const path = require('path');
const SessionUtils = require('simples/lib/utils/session-utils');

const {
	allowedHttpMethods,
	internalServerErrorStatusCode,
	methodNotAllowedStatusCode,
	noContentStatusCode,
	notFoundStatusCode,
	notModifiedStatusCode,
	verbs
} = require('simples/lib/utils/constants');

const clientDir = path.join(__dirname, '../../dist');

class HttpUtils {

	// Process HTTP requests
	static httpConnectionListener(host, requestLocation, request, response) {

		const connectionDomain = domain.create();
		const pathname = requestLocation.pathname;
		const verb = verbs.get(request.method);

		let failed = false;
		let index = 0;
		let middlewaresContainer = host._middlewares;
		let middlewaresLength = middlewaresContainer.length;
		let route = null;
		let parentRouter = host;
		let routeListener = null;

		// Check for a valid HTTP method
		if (request.method === 'OPTIONS') {
			routeListener = HttpUtils.noContent;
		} else if (verb) {

			// Select the route
			route = HttpUtils.getRoute(host._routes, verb, pathname);

			// Check for route to get the route listener and router
			if (route) {

				// Select the route listener
				routeListener = route.listener;

				// Select the route router if it is not the host
				if (route.router !== host) {
					parentRouter = route.router;
					middlewaresContainer = parentRouter._middlewares;
					middlewaresLength = middlewaresContainer.length;
				}
			}
		}

		// If the route was not found try to find the router
		if (!route) {
			parentRouter = HttpUtils.getRouter(host, requestLocation);
			middlewaresContainer = parentRouter._middlewares;
			middlewaresLength = middlewaresContainer.length;
		}

		const connection = HttpConnection.create(parentRouter, requestLocation, request, response);

		// Populate connection parameters for dynamic route
		if (route && route.dynamic) {
			pathname.match(route.pattern).slice(1).forEach((param, key) => {
				connection.params[route.keys[key]] = param;
			});
		}

		// Apply middlewares one by one and then apply the route
		const applyMiddlewares = () => {

			// Get the next router in middlewares chain to apply them
			if (index === middlewaresLength && parentRouter._parent) {
				parentRouter = parentRouter._parent;
				middlewaresContainer = parentRouter._middlewares;
				middlewaresLength = middlewaresContainer.length;
				index = 0;
			}

			// Check for middlewares to apply
			if (index < middlewaresLength) {
				middlewaresContainer[index++](connection, applyMiddlewares);
			} else {

				// Set the router keep alive timeout
				connection.keep(parentRouter._options.timeout);

				// Check for verb and available route listener to call it
				if (routeListener) {
					routeListener.call(parentRouter, connection);
				} else if (verb === 'get') {
					HttpUtils.useStaticListener(connection);
				} else if (verb) {
					connection.error(notFoundStatusCode);
				} else {
					connection.header('Allow', allowedHttpMethods);
					connection.error(methodNotAllowedStatusCode);
				}
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

			const sessionOptions = parentRouter._options.session;
			const filter = sessionOptions.filter;

			// Check for enabled session to apply it
			if (sessionOptions.enabled && (!filter || filter(connection))) {
				HttpUtils.setSession(connection, applyMiddlewares);
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
			route = HttpUtils.getDynamicRoute(pathname, dynamic[verb]);

			// Try to get the dynamic route using the "all" verb
			if (!route) {
				route = HttpUtils.getDynamicRoute(pathname, dynamic.all);
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
										HttpUtils.serveStatic(router, connection, local);
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
						HttpUtils.notModified.call(router, connection);
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
			HttpUtils.serveStatic(router, connection, path.join(clientDir, connectionPath.slice(1)));
		} else if (router._options.static.enabled) {
			HttpUtils.serveStatic(router, connection, path.join(router._options.static.location, connectionPath));
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
	static setSession(connection, callback) {

		const parentRouter = connection._router;

		// Prepare session object
		SessionUtils.getSession(parentRouter, connection, (session) => {

			const sessionOptions = {};

			// Prepare cookies options
			sessionOptions.expires = parentRouter._options.session.timeout;
			sessionOptions.path = '/';
			sessionOptions.httpOnly = true;

			// Write the session cookies
			connection.cookie('_session', session.id, sessionOptions);
			connection.cookie('_hash', session.hash, sessionOptions);

			// Link the session container to the connection
			connection.session = session.container;

			// Write the session to the store and remove its reference
			connection.on('finish', () => {
				SessionUtils.setSession(parentRouter, connection, session);
			});

			// End the session apply
			callback();
		});
	}
}

module.exports = HttpUtils;