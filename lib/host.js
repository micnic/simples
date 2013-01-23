var url = require('url');

var wsHost = require('./ws/host');

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

// Default "Not Found"
function e404(request, response) {
	response.end('"' + request.url.path + '" Not Found');
}

// Default "Method Not Allowed"
function e405(request, response) {
	response.end('"' + request.method + '" Method Not Allowed');
}

// Default "Internal Server Error"
function e500(request, response) {
	response.end('"' + request.url.path + '" Internal Server Error');
}

// Host prototype constructor
var host = module.exports = function (name) {
	'use strict';

	// Define error routes
	var error = {
		404: e404,
		405: e405,
		500: e500
	};

	// Define default routes
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
		parent: {
			value: null,
			writable: true
		},
		routes: {
			value: routes
		},
		sessions: {
			value: {},
			writable: true
		},
		started: {
			value: false,
			writable: true
		},
		wsHosts: {
			value: {}
		}
	});

	this.open();
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

// Stops the host
host.prototype.close = function () {
	'use strict';
	for (var i in this.wsHosts) {
		this.wsHosts[i].close();
	}
	this.started = false;
	return this;
};

host.prototype.destroy = function () {
	'use strict';
	this.close();

	if (this.name === 'main') {
		var error = {
			404: e404,
			405: e405,
			500: e500
		};
		this.origins = [];
		this.routes = {
			all: {},
			error: error,
			get: {},
			post: {},
			server: {}
		}
	} else {
		delete this.parent.hosts[this.name];
	}
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

// Start the host
host.prototype.open = function () {
	'use strict';
	for (var i in this.wsHosts) {
		this.wsHosts[i].open(this.wsHosts[i].config, this.wsHosts[i].callback);
	}
	this.started = true;
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

	// Create the WebSocket host
	this.wsHosts[url] = new wsHost(this, url, config, callback);

	return this.wsHosts[url];
};