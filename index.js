var url = require('url');

var server = require('./lib/server.js');
var ws = require('./lib/ws.js');

// Shortcut for server.routes
var routes = server.routes;

function simples(port) {

	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	var HTTPServer = server();
	var routes = HTTPServer.routes;
	var started = true;

	// Start server listening on specific port
	HTTPServer.listen(port);

	// Route all kind of requests
	this.all = function (path, callback) {
		routes.all[url.parse(path).pathname] = callback;
		return this;
	};

	// Route get requests
	this.get = function (path, callback) {
		routes.get[url.parse(path).pathname] = callback;
		return this;
	};

	// Route static files from specific local path
	this.getStatic = function (path) {
		routes.getStatic = path;
		return this;
	};

	// Route not found requests
	this.notFound = function (callback) {
		routes.notFound = callback;
		return this;
	};

	// Route post requests
	this.post = function (path, callback) {
		routes.post[url.parse(path).pathname] = callback;
		return this;
	};

	// Start simples server
	this.start = function (port, callback) {
		if (started) {
			HTTPServer.close(function () {
				HTTPServer.listen(port, callback);
			});
		} else {
			started = true;
			HTTPServer.listen(port, callback);
		}
		return this;
	};

	// Stop simples server
	this.stop = function (callback) {
		started = false;
		HTTPServer.close(callback);
		return this;
	};

	// New WebSocket host
	this.ws = function (url, config, callback) {

		// Check for WebSockets listening
		if (HTTPServer.listeners('upgrade').length === 0) {
			HTTPServer.on('upgrade', function (request, socket, head) {

				// Handle for WebSocket requests
				ws(request, socket, server.wsHosts[request.url]);
			});
		}

		// Configuration for the WebSocket host
		HTTPServer.wsHosts[url] = {
			config: {
				messageMaxLength: config.messageMaxLength || 1048575,
				origins: config.origins || [''],
				protocols: config.protocols || ['']
			},
			connections: [],
			callback: callback
		};

		return this;
	};
}

module.exports = simples;