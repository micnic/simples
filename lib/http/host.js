'use strict';

const Router = require('simples/lib/http/router');
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
	 */
	constructor(name) {

		super(null, null);

		// Define HTTP host private properties
		this._routers = MapContainer.dynamic();
		this._routes = HTTPHost.routesContainer();
		this._pattern = HTTPHost.getPattern(name);
	}

	/**
	 * HTTP host factory method
	 * @param {string} name
	 * @param {RouterOptions} options
	 * @returns {HTTPHost}
	 */
	static create(name, options) {

		const host = new HTTPHost(name);
		const errors = host._errors;

		// Set router options for the main router
		Router.setOptions(host, options);

		// Populate host default error routes
		errors.set(internalServerErrorStatusCode, internalServerError);
		errors.set(methodNotAllowedStatusCode, methodNotAllowed);
		errors.set(notFoundStatusCode, notFound);

		return host;
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
}

module.exports = HTTPHost;