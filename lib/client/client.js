'use strict';

var Connection = require('simples/lib/client/connection'),
	events = require('events'),
	Request = require('simples/lib/client/request'),
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

	// Assymbly the options from client options and request options
	options = utils.assign({}, this.options, options);

	return new Request(method, location, options);
};

// Create a WebSocket connection
Client.prototype.ws = function (location, mode, options) {

	// Make mode and options parameters optional
	if (utils.isObject(mode)) {
		options = mode;
		mode = 'text';
	} else if (typeof mode !== 'string') {
		mode = 'text';
		options = {};
	}

	// Set default options as an empty object
	if (!utils.isObject(options)) {
		options = {};
	}

	return new Connection(location, mode, options);
};

module.exports = Client;