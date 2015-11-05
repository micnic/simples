'use strict';

var Client = require('simples/lib/client/client'),
	Server = require('simples/lib/server'),
	Store = require('simples/lib/store'),
	utils = require('simples/utils/utils');

// simpleS server factory
module.exports = module.exports.server = function (port, options, callback) {

	// Make parameters optional
	if (typeof port === 'number') {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		} else if (!utils.isObject(options)) {
			options = {};
			callback = null;
		}
	} else if (utils.isObject(port)) {

		// Make options argument optional
		if (typeof options === 'function') {
			callback = options;
		} else {
			callback = null;
		}

		// Get the options from the port argument
		options = port;

		// Set default port for HTTP and HTTPS if no port was defined
		if (options.https) {
			port = 443;
		} else {
			port = 80;
		}
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
		options = {};
	} else {
		port = 80;
		options = {};
		callback = null;
	}

	return new Server(port, options).start(callback);
};

// simpleS client factory
module.exports.client = function (options) {
	return new Client(options);
};

// simpleS session store factory
module.exports.store = function (timeout) {
	return new Store(timeout);
};