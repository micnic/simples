'use strict';

var ClientConnection = require('simples/lib/client/connection'),
	ClientRequest = require('simples/lib/client/request'),
	events = require('events'),
	utils = require('simples/utils/utils');

// Client prototype constructor
var Client = function (options) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define private properties for client
	Object.defineProperties(this, {
		options: {
			value: options
		}
	});
};

// Client factory function
Client.create = function (options) {

	return new Client(options);
};

// Inherit from events.EventEmitter
Client.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Client
	}
});

// Make HTTP method DELETE request
Client.prototype.del = function (location, options) {

	return this.request('delete', location, options);
};

// Make HTTP method HEAD request
Client.prototype.head = function (location, options) {

	return this.request('head', location, options);
};

// Make HTTP method GET request
Client.prototype.get = function (location, options) {

	return this.request('get', location, options);
};

// Make HTTP method POST request
Client.prototype.post = function (location, options) {

	return this.request('post', location, options);
};

// Make HTTP method PUT request
Client.prototype.put = function (location, options) {

	return this.request('put', location, options);
};

// Make any HTTP method request
Client.prototype.request = function (method, location, options) {

	// Assembly the options from client options and request options
	options = utils.assign({}, this.options, options);

	return ClientRequest.create(method, location, options);
};

// Create a WebSocket connection
Client.prototype.ws = function (location, mode, options) {

	// Make mode and options parameters optional
	if (mode && typeof mode === 'object') {
		options = mode;
		mode = 'text';
	} else if (typeof mode !== 'string') {
		mode = 'text';
		options = {};
	}

	// Set default options as an empty object
	if (!options || typeof options !== 'object') {
		options = {};
	}

	return ClientConnection.create(location, mode, options);
};

module.exports = Client;