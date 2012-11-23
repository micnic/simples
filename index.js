var url = require('url');

var server = require('./lib/server');

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
	this._routes = this._server.routes;
}

// Accept requests from other origins
simples.prototype.accept = function (origins) {
	this._server.origins = origins;
	return this;
};

// Route both GET and POST requests
simples.prototype.all = function (path, callback) {
	this._routes.all[url.parse(path).pathname] = callback;
	return this;
};

// Route errors, possible values: 404, 405 and 500
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
		var that = this;
		if (this._started) {
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
		var that = this;
		if (this._started) {
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