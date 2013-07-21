'use strict';

var fs = require('fs'),
	url = require('url'),
	utils = require('../../utils/utils'),
	wsHost = require('../ws/host');

// Placeholder for rendering callback function
function nullRender() {
	console.error('simpleS: No template engine defined');
	return 'No template engine defined';
}

// Host prototype constructor
var host = function (parent, name) {

	var conf = {};

	Object.defineProperties(conf, {
		compression: { // do compression or not
			value: true,
			writable: true
		},
		limit: { // limit request body
			value: 1048576,
			writable: true
		},
		origins: { // accepted cors origins
			value: [],
			writable: true
		},
		referers: { // accepted referers
			value: [],
			writable: true
		}
	});

	Object.defineProperties(this, {
		active: {
			value: false,
			writable: true
		},
		cache: {
			value: null,
			writable: true
		},
		conf: {
			value: conf
		},
		name: {
			value: name
		},
		parent: {
			value: parent
		},
		render: {
			value: nullRender,
			writable: true
		},
		routes: {
			value: utils.defaultRoutes()
		},
		sessions: {
			value: {},
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

	// Link the host to the server and activate it
	parent.hosts[name] = this;
	this.open();
};

// Route both GET and POST requests
host.prototype.all = function (routes, callback) {
	utils.addRoutes.call(this, 'all', routes, callback);
	return this;
};

// Close the host
host.prototype.close = function () {

	var that = this;

	// Close host only if is active
	if (this.active) {
		Object.keys(this.wsHosts).forEach(function (element) {
			that.wsHosts[element].close();
		});
		this.active = false;
	}

	return this;
};

// Set the configuration of the host
host.prototype.config = function (config) {

	var that = this;

	Object.keys(config).forEach(function (element) {
		if (that.conf.hasOwnProperty(element)) {
			that.conf[element] = config[element];
		}
	});
	return this;
};

// Close and remove the host
host.prototype.destroy = function () {
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
host.prototype.engine = function (engine) {

	// Set the rendering method
	this.render = function (source, imports) {
		return engine.render(source, imports);
	};

	return this;
};

// Route errors
host.prototype.error = function (code, callback) {

	// Accept only 404, 405 and 500 error codes
	if (this.routes.error.hasOwnProperty(code)) {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
host.prototype.get = function (routes, callback) {
	utils.addRoutes.call(this, 'get', routes, callback);
	return this;
};

// Remove the route from the host
host.prototype.leave = function (type, routes) {
	utils.removeRoutes.call(this, type, routes);
	return this;
};

// Start the host
host.prototype.open = function () {

	var that = this;

	// Open host only if is not active
	if (!this.active) {
		Object.keys(this.wsHosts).forEach(function (element) {
			that.wsHosts[element].open();
		});
		this.active = true;
	}

	return this;
};

// Route post requests
host.prototype.post = function (routes, callback) {
	utils.addRoutes.call(this, 'post', routes, callback);
	return this;
};

// Route static files from a specific local path
host.prototype.serve = function (directory, callback) {

	var that = this;

	// Save the callback for directory navigation
	this.routes.serve = callback;

	// Check directory stats
	fs.stat(directory, function (error, stats) {

		// Log error and stop
		if (error) {
			console.error('simpleS: Can not read "' + directory + '"');
			console.error(error.stack + '\n');
			return;
		}

		// Check if directory is provided
		if (!stats.isDirectory()) {
			console.error('simpleS: "' + directory + '" is not a directory\n');
			return;
		}

		// Prepare the global cache object
		that.cache = {
			stats: stats
		};

		// Populate the cache
		utils.cache(that.cache, directory);
	});

	// Watch for changes in the directory
	fs.watchFile(directory, {
		persistent: false
	}, function (current) {

		// If directory still exists populate it, else clear cache and unwatch
		if (current.nlink) {
			utils.cache(that.cache, directory);
		} else {
			that.cache = {};
			fs.unwatchFile(directory);
		}
	});

	return this;
};

// New WebSocket host
host.prototype.ws = function (location, config, callback) {

	// Check the number of parameters
	if (arguments.length === 2) {
		callback = config;
		config = {};
	}

	// Get the pathname of the location
	location = url.parse(location).pathname;

	// Set default config
	config.limit = config.limit || 1048576;
	config.protocols = config.protocols || [];
	config.raw = config.raw || false;

	// Create the WebSocket host
	this.wsHosts[location] = new wsHost(location, config, callback);
	this.wsHosts[location].parent = this;

	return this.wsHosts[location];
};

module.exports = host;