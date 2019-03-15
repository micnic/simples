'use strict';

const ClientConnection = require('simples/lib/client/connection');
const Request = require('simples/lib/client/request');

const { EventEmitter } = require('events');

class Client extends EventEmitter {

	constructor(options) {

		super();

		// Define client properties
		this._options = options;
	}

	// Make HTTP method DELETE request
	delete(location, options, callback) {

		return this.request('delete', location, options, callback);
	}

	// Make HTTP method HEAD request
	head(location, options, callback) {

		return this.request('head', location, options, callback);
	}

	// Make HTTP method GET request
	get(location, options, callback) {

		return this.request('get', location, options, callback);
	}

	// Make HTTP method PATCH request
	patch(location, options, callback) {

		return this.request('patch', location, options, callback);
	}

	// Make HTTP method POST request
	post(location, options, callback) {

		return this.request('post', location, options, callback);
	}

	// Make HTTP method PUT request
	put(location, options, callback) {

		return this.request('put', location, options, callback);
	}

	// Make any HTTP method request
	request(method, location, options, callback) {

		// Assembly the options from client options and request options
		options = Object.assign({}, this._options, options);

		return new Request(method, location, options, callback);
	}

	// Create a WebSocket connection
	ws(location, advanced, options) {

		// Assembly the options from client options and request options
		options = Object.assign({}, this._options, options);

		return new ClientConnection(location, advanced, options);
	}
}

module.exports = Client;