var url = require('url');

var server = require('./lib/server');
var ws = require('./lib/ws');

var errors = [
	'\nsimpleS: Can not restart server\n',
	'\nsimpleS: Can not stop server\n'
];

module.exports = simples = function (port) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Initialize the HTTP server and start listen on the specific port
	var that = this;
	this._server = server();
	this._server.listen(port, function () {
		that._started = true;
	});

	// Shortcut for routes
	this._routes = this._server.routes;
}

// Accept request from other origins
simples.prototype.accept = function (origins) {
	this._server.origins = origins;
	return this;
};

// Route both GET and POST requests
simples.prototype.all = function (path, callback) {
	this._routes.all[url.parse(path).pathname] = callback;
	return this;
};

// Route errors, possible values: 400, 404, 405 and 500
simples.prototype.error = function (code, callback) {
	if (this._routes.error.hasOwnProperty(code)) {
		this._routes.error[code] = callback;
	}
	return this;
};

// Route get requests
simples.prototype.get = function (path, callback) {
	this._routes.get[url.parse(path).pathname] = callback;
	return this;
};

// Route post requests
simples.prototype.post = function (path, callback) {
	this._routes.post[url.parse(path).pathname] = callback;
	return this;
};

// Route static files from a specific local path
simples.prototype.serve = function (path) {
	this._routes.serve = path;
	return this;
};

// Start simples server
simples.prototype.start = function (port, callback) {

	try {

		// If the server is already started, restart it with the provided port
		if (this._started) {
			var that = this;
			this._server.close(function () {
				this.listen(port, function () {
					if (callback) {
						callback.call(that);
					}
				});
			});
		} else {
			this._started = true;
			this._server.listen(port, callback);
		}
	} catch (error) {
		console.log(errors[0] + error.message + '\n');
	}
	return this;
};

// Stop simples server
simples.prototype.stop = function (callback) {

	try {

		// Stop the server only if it is running
		if (this._started) {
			var that = this;
			this._started = false;
			this._server.close(function () {
				if (callback) {
					callback.call(that);
				}
			});
		}
	} catch (error) {
		console.log(errors[1] + error.message + '\n');
	}
	return this;
};

// New WebSocket host
simples.prototype.ws = function (url, config, callback) {

	// Check if the upgrade event is not listened
	if (this._server.listeners('upgrade').length === 0) {

		// Add listener for upgrade event to make the WebSocket handshake
		this._server.on('upgrade', function (request, socket, head) {

			// Link to the socket, for low level interaction
			request.socket = socket;

			// Handle for WebSocket requests
			ws(request, this.wsHosts[request.url]);
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