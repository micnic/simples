'use strict';

const RouteUtils = require('simples/lib/utils/route-utils');

class Route {

	/**
	 * Route constructor
	 * @param {Router} router
	 * @param {string} location
	 * @param {RouteListener} listener
	*/
	constructor(router, location, listener) {

		// Declare router public property
		this.router = router;

		// Apply route mixin on the current route
		Route.mixin(this, location, listener);
	}

	/**
	 * Route mixin method
	 * @param {Route} route
	 * @param {string} location
	 * @param {RouteListener} listener
	 */
	static mixin(route, location, listener) {

		// Add the common route properties
		route.dynamic = RouteUtils.isDynamic(location);
		route.listener = listener;
		route.location = location;

		// Check for dynamic route
		if (route.dynamic) {

			let pattern = RouteUtils.escapeRegExpString(location);

			// Replace "*" with any match
			pattern = pattern.replace(/\*/g, '.*?');

			// Add the dynamic route keys
			route.keys = [];

			// Prepare dynamic parameters match
			pattern = pattern.replace(/:[^\\/]+/g, (match) => {

				// Populate route keys
				route.keys.push(match.slice(1));

				return '([^\\/]+)';
			});

			// Add the dynamic route pattern
			route.pattern = RegExp(`^${pattern}$`);
		}
	}

	/**
	 * Normalize route location
	 * @param {string} location
	 * @returns {string}
	 */
	static normalizeLocation(location) {

		// Remove leading slash if it is missing
		if (location[0] === '/') {
			return location.slice(1);
		}

		return location;
	}
}

module.exports = Route;