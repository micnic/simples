'use strict';

var fs = require('fs'),
	path = require('path'),
	url = require('url'),
	utils = require('../../utils/utils'),
	wsHost = require('../ws/host');

// Host prototype constructor
var host = function (parent, name) {

	// Set the host properties
	Object.defineProperties(this, {
		cache: {
			value: null,
			writable: true
		},
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

	// Reset the origins
	this.origins = [];

	// Push the arguments to the origins
	while (this.origins.length !== arguments.length) {
		this.origins.push(arguments[this.origins.length]);
	}

	return this;
};

// Route both GET and POST requests
host.prototype.all = function (routes, callback) {
	utils.addRoutes.call(this, 'all', routes, callback);
	return this;
};

// Stops the host
host.prototype.close = function () {

	var that = this;

	// Close host only if is started
	if (this.started) {
		Object.keys(this.wsHosts).forEach(function (element) {
			that.wsHosts[element].close();
		});
		this.started = false;
	}

	return this;
};

// Stop and remove the host
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

	// Open host only if is not started
	if (!this.started) {
		Object.keys(this.wsHosts).forEach(function (element) {
			that.wsHosts[element].open();
		});
		this.started = true;
	}

	return this;
};

// Route post requests
host.prototype.post = function (routes, callback) {
	utils.addRoutes.call(this, 'post', routes, callback);
	return this;
};

// Specify referer access
host.prototype.referer = function () {

	// Reset the referers
	this.referers = [];

	// Push the arguments to the referers
	while (this.referers.length !== arguments.length) {
		this.referers.push(arguments[this.referers.length]);
	}

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
			console.log('simpleS: can not cache directory "' + directory + '"');
			console.log(error.stack + '\n');
			return;
		}

		// Check if directory is provided
		if (!stats.isDirectory()) {
			console.log('simpleS: "' + directory + '" is not a directory\n');
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
	fs.watchFile(directory, function (current, previous) {

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

	location = url.parse(location).pathname;

	// Set default config
	config.length = config.length || 1048576;
	config.protocols = config.protocols || [];
	config.raw = config.raw || false;

	// Create the WebSocket host
	this.wsHosts[location] = new wsHost(location, config, callback);
	this.wsHosts[location].parent = this;

	return this.wsHosts[location];
};

module.exports = host;