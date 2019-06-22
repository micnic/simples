'use strict';

const { EventEmitter } = require('events');
const ClientConnection = require('simples/lib/client/connection');
const Request = require('simples/lib/client/request');

const { assign } = Object;

class Client extends EventEmitter {

	/**
	 * Client constructor
	 * @param {*} options
	 */
	constructor(options) {

		super();

		// Define client properties
		this._options = options;
	}

	/**
	 * Make DELETE method HTTP request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Request}
	 */
	delete(location, options) {
		// TODO: use object spread in Node 10+
		return this.request(location, assign({}, options, {
			method: 'DELETE'
		}));
	}

	/**
	 * Make HEAD method HTTP request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Promise<Response>}
	 */
	head(location, options) {
		// TODO: use object spread in Node 10+
		return this.request(location, assign({}, options, {
			method: 'HEAD'
		})).send();
	}

	/**
	 * Make GET method HTTP request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Promise<Response>}
	 */
	get(location, options) {
		// TODO: use object spread in Node 10+
		return this.request(location, assign({}, options, {
			method: 'GET'
		})).send();
	}

	/**
	 * Make PATCH method HTTP request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Request}
	 */
	patch(location, options) {
		// TODO: use object spread in Node 10+
		return this.request(location, assign({}, options, {
			method: 'PATCH'
		}));
	}

	/**
	 * Make POST method HTTP request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Request}
	 */
	post(location, options) {
		// TODO: use object spread in Node 10+
		return this.request(location, assign({}, options, {
			method: 'POST'
		}));
	}

	/**
	 * Make PUT method HTTP request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Request}
	 */
	put(location, options) {
		// TODO: use object spread in Node 10+
		return this.request(location, assign({}, options, {
			method: 'PUT'
		}));
	}

	/**
	 * Make any HTTP method request
	 * @param {string} location
	 * @param {*} options
	 * @returns {Request}
	 */
	request(location, options) {

		// TODO: use object spread in Node 10+
		return new Request(location, assign({}, this._options, options));
	}

	/**
	 * Create a WebSocket connection
	 * @param {string} location
	 * @param {boolean} advanced
	 * @param {*} options
	 * @returns {ClientConnection}
	 */
	ws(location, advanced, options) {

		// TODO: use object spread in Node 10+
		return new ClientConnection(location, advanced, assign({}, this._options, options));
	}
}

module.exports = Client;