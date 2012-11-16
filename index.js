var url = require('url');

var server = require('./lib/server');
var ws = require('./lib/ws');

function simples(port) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Initialize the HTTP server and start listen on the specific port
	this._server = server();
	this._server.listen(port);
	this._started = true;

	// Shortcut routes
	this._routes = this._server.routes;
}

// Route both GET and POST requests
simples.prototype.all = function (path, callback) {
	this._routes.all[url.parse(path).pathname] = callback;
	return this;
};

// Route errors, possible values: 400, 404, 405 and 500
simples.prototype.error = function (code, callback) {
	this._routes.error[code] = callback;
	return this;
}

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

// Route post requests
simples.prototype.post = function (path, callback) {
	this._routes.post[url.parse(path).pathname] = callback;
	return this;
};

// Start simples server
simples.prototype.start = function (port, callback) {

	// If the server is already started, restart it now the provided port
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

	// Check if the upgrade event is not listened
	if (this._server.listeners('upgrade').length === 0) {

		// Link to this context
		var that = this;

		// Add listener for upgrade event to make the WebSocket handshake
		this._server.on('upgrade', function (request, socket, head) {

			request.socket = socket;

			// Handle for WebSocket requests
			ws(request, that._server.wsHosts[request.url]);
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