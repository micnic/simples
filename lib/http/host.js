var path = require('path');
var utils = require('../../utils/utils');
var wsHost = require('../ws/host');

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
			value: parent,
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
host.prototype.all = function (route, callback) {
	'use strict';
	utils.addRoute.call(this, 'all', route, callback);
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
	engine = engine.render || engine;
	prefix = prefix || '';
	
	// Set the rendering method
	this.render = function (source, imports) {
		return engine(path.join(prefix, source), imports);
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

// Start the host
host.prototype.open = function () {
	'use strict';

	// Open host only if is not started
	if (!this.started) {
		for (var i in this.wsHosts) {
			this.wsHosts[i].open();
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
host.prototype.ws = function (url, config, callback) {
	'use strict';

	// Create the WebSocket host
	this.wsHosts[url] = new wsHost(url, config, callback);
	this.wsHosts[url].parent = this;

	return this.wsHosts[url];
};