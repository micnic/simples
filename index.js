'use strict';

var Client = require('simples/lib/client/client'),
	Server = require('simples/lib/server'),
	Store = require('simples/lib/store'),
	utils = require('simples/utils/utils');

// simpleS server factory
var simples = function (port, options, callback) {

	// Make parameters optional
	if (typeof port === 'number') {
		if (typeof options === 'object') {
			options = utils.assign({}, options, {
				port: port
			});
		} else if (typeof options === 'function') {
			callback = options;
			options = {
				port: port
			};
		} else {
			options = {
				port: port
			};
			callback = null;
		}
	} else if (typeof port === 'object') {

		// Make options argument optional
		if (typeof options === 'function') {
			callback = options;
		} else {
			callback = null;
		}

		// Get the options value from the port argument
		options = port;

		// Check for null value to create an empty options object
		if (!options) {
			options = {};
		}

		// Set default port for HTTP and HTTPS if no port was defined
		if (options.https) {
			port = 443;
		} else {
			port = 80;
		}

		// Prepare the options object
		options = utils.assign({}, options, {
			port: port
		});
	} else if (typeof port === 'function') {
		callback = port;
		port = 80;
		options = {
			port: port
		};
	} else {
		port = 80;
		options = {
			port: port
		};
		callback = null;
	}

	return new Server(options).start(callback);
};

// simpleS server factory synonym
simples.server = simples;

// simpleS client factory
simples.client = function (options) {
	return new Client(options);
};

// simpleS session store factory
simples.store = function (timeout) {
	return new Store(timeout);
};

module.exports = simples;