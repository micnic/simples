'use strict';

var HttpHost = require('simples/lib/http/host'),
	HttpMixin = require('simples/lib/mixins/http-mixin'),
	Mirror = require('simples/lib/mirror'),
	ServerMixin = require('simples/lib/mixins/server-mixin'),
	WsMixin = require('simples/lib/mixins/ws-mixin');

// Server prototype constructor
var Server = function (options, callback) {

	// Call Host in this context
	HttpHost.call(this, this, 'main');

	// Define the private properties for the server
	Object.defineProperties(this, {
		hosts: {
			value: {
				dynamic: {},
				fixed: {},
				main: this
			}
		},
		mirrors: {
			value: {}
		},
		requestListener: {
			value: Server.requestListener.bind(this)
		},
		upgradeListener: {
			value: Server.upgradeListener.bind(this)
		}
	});

	// Call ServerMixin in this context
	ServerMixin.call(this, options, callback);
};

// Server factory function
Server.create = function (port, options, callback) {

	var args = ServerMixin.normalizeArguments(port, options, callback);

	return new Server(args.options, args.callback);
};

// Listener for HTTP requests
Server.requestListener = function (request, response) {

	var host = HttpMixin.getHost(this, request);

	// Process the received request
	HttpMixin.connectionListener(host, request, response);
};

// Listener for WS requests
Server.upgradeListener = function (request, socket) {

	var host = WsMixin.getHost(this, request);

	// Check for a defined WebSocket host and process received request
	if (host) {
		WsMixin.connectionListener(host, request);
	} else {
		socket.destroy();
	}
};

// Inherit from host
Server.prototype = Object.create(HttpHost.prototype, {
	constructor: {
		value: Server
	}
});

// Create a new host or return an existing one
Server.prototype.host = function (name, options) {

	var host = this;

	// Select the main host or use another one
	if (typeof name === 'string') {

		// Check the host name for a wildcard
		if (/\*/.test(name)) {

			// Create the dynamic host if it does not exist
			if (!this.hosts.dynamic[name]) {
				this.hosts.dynamic[name] = HttpHost.create(this, name);
			}

			// Select the dynamic host
			host = this.hosts.dynamic[name];
		} else {

			// Create the fixed host if it does not exist
			if (!this.hosts.fixed[name]) {
				this.hosts.fixed[name] = HttpHost.create(this, name);
			}

			// Select the fixed host
			host = this.hosts.fixed[name];
		}
	} else {
		options = null;
	}

	return host.config(options);
};

// Create a new mirror or return an existing one
Server.prototype.mirror = function (port, options, callback) {

	var args = ServerMixin.normalizeArguments(port, options, callback),
		mirror = this.mirrors[args.port];

	// Create a new mirror if there is no mirror on the port
	if (!mirror) {
		mirror = Mirror.create(this, args.options, args.callback);
		this.mirrors[args.port] = mirror;
	}

	return mirror;
};

// Start or restart the server
Server.prototype.start = function (port, callback) {

	// Start the server instance
	ServerMixin.startServer(this, port, callback);

	return this;
};

// Stop the server
Server.prototype.stop = function (callback) {

	// Stop the server instance
	ServerMixin.stopServer(this, callback);

	return this;
};

module.exports = Server;