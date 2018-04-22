'use strict';

const ClientConnection = require('simples/lib/client/connection');
const ClientRequest = require('simples/lib/client/request');

const { EventEmitter } = require('events');

class Client extends EventEmitter {

	constructor(options) {

		super();

		// Define client properties
		this._options = options;
	}

	// Make HTTP method DELETE request
	delete(location, options) {

		return this.request('delete', location, options);
	}

	// Make HTTP method HEAD request
	head(location, options) {

		return this.request('head', location, options);
	}

	// Make HTTP method GET request
	get(location, options) {

		return this.request('get', location, options);
	}

	// Make HTTP method PATCH request
	patch(location, options) {

		return this.request('patch', location, options);
	}

	// Make HTTP method POST request
	post(location, options) {

		return this.request('post', location, options);
	}

	// Make HTTP method PUT request
	put(location, options) {

		return this.request('put', location, options);
	}

	// Make any HTTP method request
	request(method, location, options) {

		// Assembly the options from client options and request options
		options = Object.assign({}, this._options, options);

		return ClientRequest.create(method, location, options);
	}

	// Create a WebSocket connection
	ws(location, advanced, options) {

		// Assembly the options from client options and request options
		options = Object.assign({}, this._options, options);

		return ClientConnection.create(location, advanced, options);
	}

	// Client factory method
	static create(options) {

		return new Client(options);
	}
}

module.exports = Client;