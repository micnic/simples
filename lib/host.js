var url = require('url');

// Add all kinds of routes
function addRoute (host, route, path, callback) {
	'use strict';

	// Add root slash if missing
	if (path.charAt(0) !== '/') {
		path = '/' + path;
	}

	// Add the route to the host
	if (route === 'serve') {
		host.routes.serve = {
			path: path,
			callback: callback
		}
	} else {
		host.routes[route][url.parse(path).pathname] = callback;
	}
}

// Host prototype constructor
var host = module.exports = function (name) {
	'use strict';

	// Define default routes
	var error = {
		// Not Found
		404: function (request, response) {
			response.end('"' + request.url.path + '" Not Found');
		},

		// Method Not Allowed
		405: function (request, response) {
			response.end('"' + request.method + '" Method Not Allowed');
		},

		// Internal Server Error
		500: function (request, response) {
			response.end('"' + request.url.path + '" Internal Server Error');
		}
	};
	var routes = {
		all: {},
		error: error,
		get: {},
		post: {},
		serve: {}
	};

	// Set the host properties
	Object.defineProperties(this, {
		name: {
			value: name
		},
		origins: {
			value: [],
			writable: true
		},
		routes: {
			value: routes
		},
		sessions: {
			value: {}
		},
		wsHosts: {
			value: {}
		}
	});
};

// Accept requests from other origins
host.prototype.accept = function () {
	'use strict';

	// Reset the origins and prepare for pushing arguments
	var index = 0;
	var length = arguments.length;
	this.origins = [];

	// Push the arguments to the origins
	while (index < length) {
		this.origins[index] = arguments[index++];
	}

	return this;
};

// Route both GET and POST requests
host.prototype.all = function (path, callback) {
	'use strict';
	addRoute(this, 'all', path, callback);
	return this;
};

// Route errors
host.prototype.error = function (code, callback) {
	'use strict';

	// Accept only 404, 405 and 500 error codes
	if (this.routes.error.hasOwnProperty(code)) {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
host.prototype.get = function (path, callback) {
	'use strict';
	addRoute(this, 'get', path, callback);
	return this;
};

// Route post requests
host.prototype.post = function (path, callback) {
	'use strict';
	addRoute(this, 'post', path, callback);
	return this;
};

// Route static files from a specific local path
host.prototype.serve = function (path, callback) {
	'use strict';
	addRoute(this, 'serve', path, callback);
	return this;
};

// New WebSocket host
host.prototype.ws = function (url, config, callback) {
	'use strict';

	// Configuration for the WebSocket host
	this.wsHosts[url] = {
		config: {
			length: config.length || 1048575,
			protocols: config.protocols.sort() || [],
			raw: config.raw || false
		},
		connections: [],
		callback: callback
	};

	return this;
};