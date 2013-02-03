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

	// Shortcut to this context
	var that = this;

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

	// Prepare sessions for saving in file
	function getSessions() {

		var timeout;
		var start;
		var end;

		for (var i in that.sessions) {
			timeout = that.sessions[i]._timeout;
			start = new Date(timeout._idleStart).valueOf();
			end = new Date(start + timeout._idleTimeout).valueOf();
			clearTimeout(timeout);
			that.sessions[i]._timeout = end - new Date().valueOf();
		}

		return that.sessions;
	}

	// Populate sessions from an object
	function setSessions(sessions) {

		if (!sessions) {
			return;
		}

		that.sessions = sessions;

		function cleaner(index) {
			delete that.sessions[index];
		}

		for (var i in that.sessions) {
			that.sessions[i]._timeout = setTimeout(cleaner, that.sessions[i]._timeout, i);
		}
	}

	// Set the host properties
	Object.defineProperties(this, {
		getSessions: {
			value: getSessions
		},
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
		referers: {
			value: [],
			writable: true
		},
		render: {
			value: null,
			writable: true
		},
		renderer: {
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
		setSessions: {
			value: setSessions
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

	// Close host only if is started
	if (this.started) {
		for (var i in this.wsHosts) {
			this.wsHosts[i].close();
		}
		this.started = false;
	}
	
	return this;
};

// Stop and remove the host
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

// Specify the template engine to render the responses
host.prototype.engine = function (engine, render) {
	'use strict';

	// Prepare template engine
	this.renderer = engine;

	// Choose the rendering method
	if (render) {
		this.render = engine[render];
	} else if (engine.render) {
		this.render = engine.render;
	} else {
		this.render = engine;
	}

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

// Start the host
host.prototype.open = function () {
	'use strict';

	var wsHosts = this.wsHosts;

	// Open host only if is not started
	if (!this.started) {
		for (var i in wsHosts) {
			wsHosts[i].open(wsHosts[i].config, wsHosts[i].callback);
		}
		this.started = true;
	}
	
	return this;
};

// Route post requests
host.prototype.post = function (path, callback) {
	'use strict';
	addRoute(this, 'post', path, callback);
	return this;
};

// Specify referer acces
host.prototype.referer = function () {
	'use strict';

	// Reset the origins and prepare for pushing arguments
	var index = 0;
	var length = arguments.length;
	this.referers = [];

	// Push the arguments to the origins
	while (index < length) {
		this.referers[index] = arguments[index++];
	}
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
	this.wsHosts[url] = new wsHost(url, config, callback);
	this.wsHosts[url].parent = this;

	return this.wsHosts[url];
};