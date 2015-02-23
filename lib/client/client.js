'use strict';

var connection = require('simples/lib/client/connection'),
	events = require('events'),
	request = require('simples/lib/client/request');

// Client prototype constructor
var client = function () {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);
};

// Inherit from events.EventEmitter
client.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: client
	}
});

// Make HTTP method DELETE request
client.prototype.del = function (location, options) {

	return this.request('delete', location, options);
};

// Make HTTP method HEAD request
client.prototype.head = function (location, options) {

	return this.request('head', location, options);
};

// Make HTTP method GET request
client.prototype.get = function (location, options) {

	return this.request('get', location, options);
};

// Make HTTP method POST request
client.prototype.post = function (location, options) {

	return this.request('post', location, options);
};

// Make HTTP method PUT request
client.prototype.put = function (location, options) {

	return this.request('put', location, options);
};

// Make any HTTP method request
client.prototype.request = function (method, location, options) {

	return new request(this, method, location).config(options);
};

// Create a WebSocket connection
client.prototype.ws = function (location, mode, options) {

	// Make mode and options parameters optional
	if (typeof mode === 'object') {
		options = mode;
		mode = 'text';
	} else if (typeof mode !== 'string') {
		mode = 'text';
	}

	return new connection(this, location, mode).config(options);
};

module.exports = client;