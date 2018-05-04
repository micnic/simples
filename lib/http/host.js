'use strict';

const HttpRouter = require('simples/lib/http/router');
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

const mainRouterLocation = '/'; // The location of the host as the main router

const routesVerbs = ['all', 'delete', 'get', 'patch', 'post', 'put'];

class HttpHost extends HttpRouter {

	constructor(name, routerOptions) {

		super(null, mainRouterLocation, routerOptions);

		// Define HTTP host private properties
		this._dynamic = HttpHost.isDynamic(name);
		this._name = name;
		this._routers = MapContainer.create('dynamic', 'fixed');
		this._routes = HttpHost.routesContainer();

		// Add pattern property for dynamic HTTP hosts
		if (this._dynamic) {
			this._pattern = HttpHost.getPattern(name);
		}
	}

	// HTTP host factory method
	static create(server, name, options) {

		const host = new HttpHost(name, options);
		const errors = host._errors;
		const hostsContainer = server._hosts;

		// Populate host default error routes
		errors.set(internalServerErrorStatusCode, internalServerError);
		errors.set(methodNotAllowedStatusCode, methodNotAllowed);
		errors.set(notFoundStatusCode, notFound);

		// Add the host to the hosts container based on its type
		if (host._dynamic) {
			hostsContainer.dynamic.set(name, host);
		} else {
			hostsContainer.fixed.set(name, host);
		}

		return host;
	}

	// Create a routes objects container
	static routesContainer() {

		return {
			dynamic: MapContainer.create(...routesVerbs),
			fixed: MapContainer.create(...routesVerbs),
			ws: MapContainer.create('dynamic', 'fixed')
		};
	}
}

module.exports = HttpHost;