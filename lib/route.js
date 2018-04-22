'use strict';

class Route {

	constructor(router, location, listener) {

		this.router = router;

		Route.mixin(this, location, listener);
	}

	// Route factory method
	static create(router, location, listener) {

		return new Route(router, location, listener);
	}

	// Escape all regular expression special characters except "*" from string
	static escapeRegExpString(str) {

		return str.replace(/[-[\]/{}()+?.\\^$|]/g, '\\$&');
	}

	static isDynamic(location) {

		return /:|\*/.test(location);
	}

	// Route mixin method
	static mixin(instance, location, listener) {

		// Add the common route properties
		instance.dynamic = Route.isDynamic(location);
		instance.listener = listener;
		instance.location = location;

		// Check for dynamic route
		if (instance.dynamic) {

			let pattern = Route.escapeRegExpString(location);

			// Replace "*" with any match
			pattern = pattern.replace(/\*/g, '.*?');

			// Add the dynamic route keys
			instance.keys = [];

			// Prepare dynamic parameters match
			pattern = pattern.replace(/:([^\\/]+)/g, (match, key) => {
				instance.keys.push(key);
				return '([^\\/]+)';
			});

			// Add the dynamic route pattern
			instance.pattern = RegExp(`^${pattern}$`);
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