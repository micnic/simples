var path = require('path'),
	url = require('url'),
	utils = require('../../utils/utils'),
	wsHost = require('../ws/host');

// Host prototype constructor
var host = module.exports = function (parent, name) {
	'use strict';

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
			value: parent
		},
		referers: {
			value: [],
			writable: true
		},
		render: {
			value: null,
			writable: true
		},
		routes: {
			value: utils.defaultRoutes()
		},
		sessions: {
			value: {},
			writable: true
		},
		started: {
			value: false,
			writable: true
		},
		timers: {
			value: {},
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
	var index = arguments.length;
	this.origins = [];

	// Push the arguments to the origins
	while (index--) {
		this.origins[index] = arguments[index];
	}

	return this;
};

// Route both GET and POST requests
host.prototype.all = function (route, callback) {
	'use strict';
	utils.addRoute.call(this, 'all', route, callback);
	return this;
};

// Stops the host
host.prototype.close = function () {
	'use strict';

	var index;

	// Close host only if is started
	if (this.started) {
		for (index in this.wsHosts) {
			this.wsHosts[index].close();
		}
		this.started = false;
	}

	return this;
};

// Stop and remove the host
host.prototype.destroy = function () {
	'use strict';
	this.close();

	// Clean the main host or remove the host
	if (this.name === 'main') {
		this.origins = [];
		this.routes = utils.defaultRoutes();
	} else {
		delete this.parent.hosts[this.name];
	}
};

// Specify the template engine to render the responses
host.prototype.engine = function (engine, prefix) {
	'use strict';

	// Prepare the rendering parameters
	var render = engine.render || engine;
	prefix = prefix || '';

	// Set the rendering method
	this.render = function (source, imports) {
		return render.call(engine, path.join(prefix, source), imports);
	};

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
host.prototype.get = function (route, callback) {
	'use strict';
	utils.addRoute.call(this, 'get', route, callback);
	return this;
};

// Remove the route from the host
host.prototype.leave = function (type, route) {
	'use strict';
	var defaultRoutes = utils.defaultRoutes();

	// Check if route or type is defined
	if (route) {

		// Remove root and get pathname
		if (route.charAt(0) === '/') {
			route = route.substr(1);
		}
		route = url.parse(route).pathname || '';

		// Check for advanced route
		if (~route.indexOf(':')) {
			delete this.routes[type].advanced[route];
		} else {
			if (type === 'error') {
				this.routes.error[route] = defaultRoutes.error[route];
			} else {
				delete this.routes[type].raw[route];
			}
		}
	} else if (type) {
		this.routes[type] = defaultRoutes[type];
	} else {
		this.routes = defaultRoutes;
	}
	
	return this;
};

// Start the host
host.prototype.open = function () {
	'use strict';

	var index;

	// Open host only if is not started
	if (!this.started) {
		for (index in this.wsHosts) {
			this.wsHosts[index].open();
		}
		this.started = true;
	}

	return this;
};

// Route post requests
host.prototype.post = function (route, callback) {
	'use strict';
	utils.addRoute.call(this, 'post', route, callback);
	return this;
};

// Specify referer access
host.prototype.referer = function () {
	'use strict';

	// Reset the origins and prepare for pushing arguments
	var index = arguments.length;
	this.referers = [];

	// Push the arguments to the origins
	while (index--) {
		this.referers[index] = arguments[index];
	}

	return this;
};

// Route static files from a specific local path
host.prototype.serve = function (path, callback) {
	'use strict';
	utils.addRoute.call(this, 'serve', path, callback);
	return this;
};

// New WebSocket host
host.prototype.ws = function (location, config, callback) {
	'use strict';

	location = url.parse(location).pathname;

	// Create the WebSocket host
	this.wsHosts[location] = new wsHost(location, config, callback);
	this.wsHosts[location].parent = this;

	return this.wsHosts[location];
};