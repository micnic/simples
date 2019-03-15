'use strict';

class RouteUtils {

	// Escape all regular expression special characters except "*" from string
	static escapeRegExpString(str) {

		return str.replace(/[-[\]/{}()+?.\\^$|]/g, '\\$&');
	}

	// Check if route location is a dynamic one
	static isDynamic(location) {

		return /:|\*/.test(location);
	}

	static setPattern(instance, location, param) {

		let pattern = RouteUtils.escapeRegExpString(location);

		// Replace "*" with any match
		pattern = pattern.replace(/\*/g, '.*?');

		if (param) {

			// Add the dynamic route keys
			instance.keys = [];

			// Prepare dynamic parameters match
			pattern = pattern.replace(/:[^\\/]+/g, (match) => {

				// Populate route keys
				instance.keys.push(match.slice(1));

				return '([^\\/]+)';
			});
		}

		// Add the dynamic route pattern
		instance._pattern = RegExp(`^${pattern}$`);
	}
}

module.exports = RouteUtils;