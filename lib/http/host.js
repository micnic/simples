'use strict';

const Router = require('simples/lib/http/router');
const RouteUtils = require('simples/lib/utils/route-utils');
const MapContainer = require('simples/lib/utils/map-container');

const {
	internalServerErrorStatusCode,
	methodNotAllowedStatusCode,
	notFoundStatusCode
} = require('simples/lib/utils/constants');

const {
	internalServerError,
	methodNotAllowed,
	notFound
} = require('simples/lib/utils/http-utils');

class HTTPHost extends Router {

	/**
	 * HTTP host constructor
	 * @param {string} name
	 * @param {RouterOptions} options
	 */
	constructor(name, options) {

		super(null, null, options);

		// Check for dynamic HTTP host name
		if (HTTPHost.isDynamic(name)) {

			let pattern = RouteUtils.escapeRegExpString(name);

			// Replace "*" with any match
			pattern = pattern.replace(/\*/g, '.*?');

			// Set host name pattern
			this._pattern = RegExp(`^${pattern}$`);
		}

		// Set default error routes
		HTTPHost.setErrorRoutes(this);

		// Define HTTP host private properties
		this._routers = MapContainer.dynamic();
		this._routes = HTTPHost.routesContainer();
	}

	/**
	 * Check if HTTP host name is dynamic
	 * @param {string} name
	 * @returns {boolean}
	 */
	static isDynamic(name) {

		return /\*/.test(name);
	}

	/**
	 * Create a routes objects container
	 * @returns {RoutesContainer}
	 */
	static routesContainer() {

		return {
			dynamic: MapContainer.routes(),
			fixed: MapContainer.routes(),
			ws: MapContainer.dynamic()
		};
	}

	// Set default error routes
	static setErrorRoutes(host) {

		const errors = host._errors;

		// Populate host default error routes
		errors.set(internalServerErrorStatusCode, internalServerError);
		errors.set(methodNotAllowedStatusCode, methodNotAllowed);
		errors.set(notFoundStatusCode, notFound);
	}
}

module.exports = HTTPHost;