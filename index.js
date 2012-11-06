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

	// Initialize server and start listen on the specific port
	this._server = server();
	this._server.listen(port);
	this._started = true;

	// Shortcut routes
	this._routes = this._server.routes;
}

// Route all kind of requests
simples.prototype.all = function (path, callback) {
	this._routes.all[url.parse(path).pathname] = callback;
	return this;
};

// Route get requests
simples.prototype.get = function (path, callback) {
	this._routes.get[url.parse(path).pathname] = callback;
	return this;
};

// Route static files from a specific local path
simples.prototype.getStatic = function (path) {
	this._routes.getStatic = path;
	return this;
};

// Route not found requests
simples.prototype.notFound = function (callback) {
	this._routes.notFound = callback;
	return this;
};

// Route post requests
simples.prototype.post = function (path, callback) {
	this._routes.post[url.parse(path).pathname] = callback;
	return this;
};

// Start simples server
simples.prototype.start = function (port, callback) {
	if (this._started) {
		this._server.close(function () {
			this._server.listen(port, callback);
		});
	} else {
		this._started = true;
		this._server.listen(port, callback);
	}
	return this;
};

// Stop simples server
simples.prototype.stop = function (callback) {
	this._started = false;
	this._server.close(callback);
	return this;
};

// New WebSocket host
simples.prototype.ws = function (url, config, callback) {

	// Check for WebSockets listening
	if (this._server.listeners('upgrade').length === 0) {
		this._server.on('upgrade', function (request, socket, head) {

			// Handle for WebSocket requests
			ws(request, socket, server.wsHosts[request.url]);
		});
	}

	// Configuration for the WebSocket host
	this._server.wsHosts[url] = {
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

module.exports = simples;