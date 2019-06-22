'use strict';

const fs = require('fs');
const path = require('path');
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

class HTTPUtils {

	// Apply router middlewares
	static applyMiddlewares(router, connection) {

		// In case of main router and no middleware do nothing
		if (router._host === router && router._middlewares.size === 0) {
			return Promise.resolve();
		}

		let iterator = router._middlewares.values();
		let r = router;

		return new Promise((resolve, reject) => {

			const next = (error) => {

				const iteration = iterator.next();

				// Check for any error or continue iteration
				if (error) {
					reject(error);
				} else if (iteration.done) {
					if (r._parent) {
						r = r._parent;
						iterator = r._middlewares.values();
						next();
					} else {
						resolve();
					}
				} else {
					iteration.value(connection, next);
				}
			};

			// Start iteration
			next();
		});
	}

	// Set the session cookies for HTTP connections
	static applySession(connection) {

		return Session.for(connection).then((session) => {

			// Write the session cookies
			connection.cookie('_session', session.id, {
				expires: session.timeout,
				httpOnly: true,
				path: '/'
			});
		});
	}

	// Process HTTP requests
	static connectionListener(host, location, request, response) {

		const { pathname } = location;
		const verb = verbs.get(request.method);
		const route = HTTPUtils.getRoute(host._routes, verb, pathname);
		const router = HTTPUtils.getRouter(host, route, pathname);
		const session = router._options.session;
		const connection = new HTTPConnection(router, location, request, response);

		// Populate connection parameters for dynamic route
		if (route && route.dynamic) {
			pathname.match(route.pattern).slice(1).forEach((param, key) => {
				connection.params[route.keys[key]] = param;
			});
		}

		// Check for enabled session to apply it
		if (Config.isEnabled(session.enabled, connection)) {
			HTTPUtils.applySession(connection).then(() => {

				return HTTPUtils.applyMiddlewares(router, connection);
			}).then(() => {
				HTTPUtils.handleRoute(router, route, connection);
			}).catch((error) => {
				HTTPUtils.errorListener(router, connection, error);
			});
		} else {
			HTTPUtils.applyMiddlewares(router, connection).then(() => {
				HTTPUtils.handleRoute(router, route, connection);
			}).catch((error) => {
				HTTPUtils.errorListener(router, connection, error);
			});
		}
	}

	// Handle any possible errors
	static errorListener(router, connection, error) {

		// Emit safely the error to the host
		ErrorEmitter.emit(router, error);

		// Try to apply the route for error 500 or destroy the connection
		if (!connection._started && !connection._failed) {

			// Set failed flag and provide the error to the connection data
			connection._failed = true;
			connection.data.error = error;

			// Handle the internal server error route
			HTTPUtils.handleInternalServerError(router, connection);
		} else {
			connection.destroy();
		}
	}

	// Returns the dynamic route if found
	static getDynamicRoute(pathname, routes, verb) {

		// Loop through routes to find the one that match the location pattern
		for (const route of routes[verb].values()) {
			if (route.pattern.test(pathname)) {
				return route;
			}
		}

		// Loop through routes to find the one that match the location pattern
		for (const route of routes.all.values()) {
			if (route.pattern.test(pathname)) {
				return route;
			}
		}

		return null;
	}

	// Returns the fixed or the dynamic route for the provided connection
	static getRoute(routes, verb, pathname) {

		const { fixed } = routes;

		// Check for verb
		if (verb) {

			// Try to get the fixed or the dynamic route
			if (fixed[verb].has(pathname)) {
				return fixed[verb].get(pathname);
			} else if (fixed.all.has(pathname)) {
				return fixed.all.get(pathname);
			}

			const dynamic = routes.dynamic;

			// Try to get the dynamic route using the provided verb
			return HTTPUtils.getDynamicRoute(pathname, dynamic, verb);
		}

		return null;
	}

	// Get the router that matches the request location
	static getRouter(host, route, location) {

		// If router is provided just get its router
		if (route) {
			return route.router;
		}

		// Loop through fixed routers to find the one that matches
		for (const [ routerLocation ] of host._routers.fixed) {
			if (location.startsWith(routerLocation)) {
				return host._routers.fixed.get(routerLocation);
			}
		}

		// Loop through dynamic routers to find the one that matches
		for (const [ routerLocation, router ] of host._routers.dynamic) {
			if (router._pattern.test(location)) {
				return host._routers.dynamic.get(routerLocation);
			}
		}

		return host;
	}

	// Try to handle internal server error or emit safely errors
	static handleInternalServerError(router, connection) {
		try {
			connection.error(internalServerErrorStatusCode);
		} catch (error) {
			HTTPUtils.errorListener(router, connection, error);
		}
	}

	// Handle route
	static handleRoute(router, route, connection) {

		const { method } = connection.request;
		const verb = verbs.get(method);

		// Check for route to handle it
		if (route) {
			route.listener.call(router, connection);
		} else if (verb === 'get') {
			HTTPUtils.useStaticListener(connection);
		} else if (verb) {
			connection.error(notFoundStatusCode);
		} else if (method === 'OPTIONS') {
			HTTPUtils.noContent.call(router, connection);
		} else {
			connection.header('Allow', allowedHTTPMethods);
			connection.error(methodNotAllowedStatusCode);
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

	// Serve static file
	static serveStatic(router, connection, location) {
		fs.stat(location, (error, stats) => {
			if (error) {
				connection.error(notFoundStatusCode);
			} else {

				const timestamp = stats.mtime.toUTCString();

				// Set the last modified time stamp
				connection.header('Last-Modified', timestamp);

				// Check for directory to serve index file
				if (stats.isDirectory()) {
					if (router._options.static.index.length) {

						let index = 0;

						const checkStaticLocation = () => {

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

					const extension = path.extname(location);

					// Set the content type for files
					if (extension) {
						connection.type(extension);
					}

					// Check file timestamp to call "Not Modified" if it is the case
					if (connection.headers['if-modified-since'] === timestamp) {
						HTTPUtils.notModified.call(router, connection);
					} else {
						// In Node 10+ use stream.pipeline()
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
		if (router._options.static.enabled) {
			HTTPUtils.serveStatic(router, connection, path.join(router._options.static.location, connectionPath));
		} else {
			connection.error(notFoundStatusCode);
		}
	}
}

module.exports = HTTPUtils;