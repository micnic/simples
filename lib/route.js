'use strict';

// Route prototype constructor
var Route = function (location, listener) {

	var keys = [],
		pattern = null;

	// Add the common route properties
	Object.defineProperties(this, {
		dynamic: {
			value: /\:|\*/.test(location)
		},
		listener: {
			value: listener,
			writable: true
		},
		location: {
			value: location
		}
	});

	// Check for dynamic route
	if (this.dynamic) {

		// Escape all RegExp special characters except "*"
		pattern = location.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, '\\$&');

		// Replace "*" with any match
		pattern = pattern.replace(/\*/g, '.*?');

		// Prepare dynamic parameters match
		pattern = pattern.replace(/:([^\\.]+)/g, function (match, key) {
			keys.push(key);
			return '([^\\/]+)';
		});

		// Add the dynamic route properties
		Object.defineProperties(this, {
			keys: {
				value: keys
			},
			pattern: {
				value: RegExp('^' + pattern + '$')
			}
		});
	}
};

// Route factory function
Route.create = function (location, listener) {

	return new Route(location, listener);
};

module.exports = Route;