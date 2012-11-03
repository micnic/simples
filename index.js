var url = require('url');

var server = require('./lib/server.js');
var ws = require('./lib/ws.js');

module.exports = simples;

function simples(port) {

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Start server listening on specific port
	server.listen(port);
	var started = true;

	// Route all king of requests
	this.all = function (path, callback) {
		server.ALLroutes[url.parse(path).pathname] = callback;
		return this;
	}

	// Route get requests
	this.get = function (path, callback) {
		server.GETroutes[url.parse(path).pathname] = callback;
		return this;
	}

	// Route not found requests
	this.notFound = function (callback) {
		server.notFound = callback;
		return this;
	}

	// Route post requests
	this.post = function (path, callback) {
		server.POSTroutes[url.parse(path).pathname] = callback;
		return this;
	}

	// Route static files from specific local path
	this.getStatic = function (path) {
		server.staticRoute = path;
		return this;
	}

	// Start simples server
	this.start = function (port, callback) {
		if (started) {
			server.close(function () {
				server.listen(port, callback);
			});
		} else {
			server.listen(port, callback);
		}
		return this;
	}

	// Stop simples server
	this.stop = function (callback) {
		server.close(callback);
		return this;
	}

	// New WebSocket host
	this.ws = function (url, config, callback) {

		// Check for WebSockets listening
		if (!server.listeners('upgrade').length) {
			server.on('upgrade', function (request, socket, head) {

				// Handle for WebSocket requests
				ws(request, socket, wsHosts[request.url]);	
			});
		}

		// Default configuration for websocket hosts
		server.wsHosts[url] = {
			config: {
				messageMaxLength: 1048575,
				origins: [''],
				protocols: ['']
			},
			connections: [],
			callback: callback
		};

		// Change configuration
		for (var i in config) {
			if (server.wsHosts[url].config[i]) {
				server.wsHosts[url].config[i] = config[i];
			}
		}

		return this;
	}
}