'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const { extname } = require('path');
const FormData = require('simples/lib/client/form-data');
const Response = require('simples/lib/client/response');
const TypeUtils = require('simples/lib/utils/type-utils');
const url = require('url');

const { assign, keys } = Object;

const requestAborted = Error('Request aborted');

class Request {

	/**
	 * Request constructor
	 * @param {string} location
	 * @param {*} options
	 */
	constructor(location, options) {

		this._location = location;
		// TODO: use object spread in Node 10+
		this._options = assign({}, options);
		this._request = null;
	}

	/**
	 * Abort request
	 */
	abort() {
		if (this._request) {
			this.request.abort();
		}
	}

	/**
	 * Drain data from a readable source stream and send it to the server
	 * @param {string|fs.ReadStream} source
	 * @param {string} type
	 * @param {boolean} override
	 * @returns {Promise<Response>}
	 */
	drain(source, type, override) {

		// Get content type from file path if type is not provided
		if (typeof source === 'string') {
			if (typeof type === 'string') {
				this.type(type, override);
			} else {
				this.type(extname(source));
			}
		} else if (typeof type === 'string') {
			this.type(type, override);
		}

		return new Promise((resolve, reject) => {

			this._request = Request.makeRequest(this._location, this._options);

			this._request.once('abort', () => {
				reject(requestAborted);
				this._request = null;
			});

			// Add error listener
			this._request.once('error', (error) => {
				reject(error);
				this._request = null;
			});

			// Add response listener
			this._request.once('response', (response) => {
				resolve(new Response(response));
				this._request = null;
			});

			if (typeof source === 'string') {
				// Pipe the content of the file to the connection stream
				// TODO: In Node 10+ use stream.pipeline()
				fs.ReadStream(source).pipe(this);
			} else {
				// Pipe the content of the source stream to the request
				// TODO: In Node 10+ use stream.pipeline()
				source.pipe(this._request);
			}
		});
	}

	/**
	 * Send multipart form data to the server
	 * @param {*} data
	 * @returns {Promise<Response>}
	 */
	form(data) {

		const formData = new FormData(data);
		const type = `multipart/form-data; boundary=${formData.boundary}`;

		return this.drain(formData, type, true);
	}

	/**
	 * Get, set or remove request headers
	 * @param {string} name
	 * @param {string} value
	 * @returns {string|this}
	 */
	header(name, value) {

		if (arguments.length === 1) {
			return this._options.headers[name];
		}

		if (value === null) {
			delete this._options.headers[name];
		} else {
			// TODO: use object spread in Node 10+
			this._options.headers = assign({}, this._options.headers, {
				[name]: value
			});
		}

		return this;
	}

	/**
	 * Send URL encoded data to the server
	 * @param {*} data
	 * @returns {Promise<Response>}
	 */
	qs(data) {

		// TODO: use object spread in Node 10+
		const result = keys(assign({}, data)).map((key) => {

			if (Array.isArray(data[key])) {

				return data[key].map((element) => {

					if (typeof element === 'object' || element === undefined) {
						return `${key}=`;
					}

					return `${key}=${element}`;
				}).join('&');
			}

			if (typeof data[key] === 'object' || data[key] === undefined) {
				return `${key}=`;
			}

			return `${key}=${data[key]}`;
		}).join('&');

		return this.send(result, 'application/x-www-form-urlencoded', true);
	}

	/**
	 * Send data to the server
	 * @param {string|Buffer|Callback} data
	 * @param {string} type
	 * @param {boolean} override
	 * @returns {Promise<Response>}
	 */
	send(data, type, override) {

		const options = this._options;

		// Check for data to set content type
		if (data && typeof data !== 'function') {
			if (typeof type === 'string') {
				this.type(type, override);
			} else if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
				this.type('json');
				data = JSON.stringify(data);
			}
		}

		return new Promise((resolve, reject) => {

			this._request = Request.makeRequest(this._location, options);

			this._request.once('abort', () => {
				reject(requestAborted);
				this._request = null;
			});

			// Add error listener
			this._request.once('error', (error) => {
				reject(error);
				this._request = null;
			});

			// Add response listener
			this._request.once('response', (response) => {
				resolve(new Response(response));
				this._request = null;
			});

			// Add upgrade listener
			this._request.once('upgrade', (response) => {
				resolve(new Response(response));
				this._request = null;
			});

			// Write data to the request and end it
			this._request.end(data);
		});
	}

	/**
	 * Get, set or remove the content type of the request
	 * @param {null|string} value
	 * @param {boolean} override
	 * @returns {string|this}
	 */
	type(value, override) {

		// Return content type if no arguments provided
		if (arguments.length === 0) {
			return this.header('Content-Type');
		}

		let type = value;

		// Check for string content type and no override
		if (typeof type === 'string' && override !== true) {
			type = TypeUtils.getContentType(type);
		}

		return this.header('Content-Type', type);
	}

	/**
	 * Return the requester function based on the provided protocol
	 * @param {string} protocol
	 * @returns {http.request|https.request}
	 */
	static getRequester(protocol) {

		// Check for HTTPS protocol
		if (protocol === 'https:') {
			return https.request;
		}

		return http.request;
	}

	/**
	 * Make a request using provided location and options
	 * @param {string} location
	 * @param {*} options
	 * @returns {http.ClientRequest}
	 */
	static makeRequest(location, options) {

		const {
			auth,
			host,
			hostname,
			path,
			port,
			protocol
		} = url.parse(location);
		const requester = Request.getRequester(protocol);

		// TODO: use object spread in Node 10+
		return requester(assign({}, options, {
			auth,
			host,
			hostname,
			path,
			port,
			protocol
		}));
	}
}

module.exports = Request;