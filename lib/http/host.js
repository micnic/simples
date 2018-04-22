'use strict';

const HttpRouter = require('simples/lib/http/router');
const HttpUtils = require('simples/lib/utils/http-utils');

const {
	internalServerErrorStatusCode,
	methodNotAllowedStatusCode,
	notFoundStatusCode
} = require('simples/lib/utils/constants');

const mainRouterLocation = '/'; // The location of the host as the main router

class HttpHost extends HttpRouter {

	constructor(hostName, routerOptions) {

		super(null, mainRouterLocation, routerOptions);

		// Define HTTP host private properties
		this._dynamic = HttpHost.isDynamic(hostName);
		this._name = hostName;
		this._routers = HttpHost.routersContainer();
		this._routes = HttpHost.routesContainer();

		// Add pattern property for dynamic HTTP hosts
		if (this._dynamic) {
			this._pattern = HttpHost.getPattern(hostName);
		}

		// Populate default error routes
		this._errors.set(internalServerErrorStatusCode, HttpUtils.internalServerError);
		this._errors.set(methodNotAllowedStatusCode, HttpUtils.methodNotAllowed);
		this._errors.set(notFoundStatusCode, HttpUtils.notFound);
	}

	// HTTP host factory method
	static create(server, nameValue, options) {

		const host = new HttpHost(nameValue, options);
		const hostsContainer = server._hosts;

		// Add the host to the hosts container based on its type
		if (host._dynamic) {
			hostsContainer.dynamic.set(nameValue, host);
		} else {
			hostsContainer.fixed.set(nameValue, host);
		}

		return host;
	}

	// Create a routers objects container
	static routersContainer() {

		return {
			dynamic: new Map(),
			fixed: new Map()
		};
	}

	// Create a routes objects container
	static routesContainer() {

		return {
			dynamic: {
				all: new Map(),
				delete: new Map(),
				get: new Map(),
				patch: new Map(),
				post: new Map(),
				put: new Map()
			},
			fixed: {
				all: new Map(),
				delete: new Map(),
				get: new Map(),
				patch: new Map(),
				post: new Map(),
				put: new Map()
			},
			ws: {
				dynamic: new Map(),
				fixed: new Map()
			}
		};
	}
}

module.exports = HttpHost;