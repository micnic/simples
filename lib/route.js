'use strict';

const RouteUtils = require('simples/lib/utils/route-utils');

class Route {

	constructor(router, location, listener) {

		this.router = router;

		Route.mixin(this, location, listener);
	}

	// Route mixin method
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

	// Normalize route location
	static normalizeLocation(location) {

		// Add leading slash if it is missing
		if (location[0] === '/') {
			location = location.slice(1);
		}

		return location;
	}
}

module.exports = Route;