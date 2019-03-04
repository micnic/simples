'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const zlib = require('zlib');

const { PassThrough } = require('stream');

class ClientRequest extends PassThrough {

	constructor(method, location, options, callback) {

		let request = null;

		super();

		// Create a response stream
		this._response = PassThrough();

		// Make method to be lowercased for comparison
		method = method.toLowerCase();

		// Parse the location to obtain the location object
		location = url.parse(location);

		// Prepare options object
		options = Object.assign({}, options, {
			host: location.host,
			hostname: location.hostname,
			method,
			path: location.path,
			port: location.port
		});

		// Create the request based on the used protocol
		if (location.protocol === 'https:') {
			request = https.request(options);
		} else {
			request = http.request(options);
		}

		// Add response and error listeners to the request
		request.on('response', (response) => {

			let body = Buffer.alloc(0);
			let length = 0;
			let encoding = '';

			// Check for content encoding
			if (response.headers['content-encoding']) {
				encoding = response.headers['content-encoding'].toLowerCase();
			}

			// Pipe the response to the external response
			// In Node 10+ use stream.pipeline()
			response.pipe(this._response);

			// Emit the response event
			this.emit('response', response);

			// Listen for response errors
			response.on('error', (error) => {
				this.emit('error', error);
			});

			// Check for provided callback to attach it to the body event
			if (typeof callback === 'function') {
				this.on('body', callback);
			}

			// Check for body event listeners and process the received data
			if (this.listeners('body').length) {

				const decompress = ClientRequest.decompress(this, response);

				// Add data and end listeners
				response.on('data', (data) => {
					length += data.length;
					body = Buffer.concat([body, data], length);
				}).on('end', () => {
					if (encoding === 'deflate') {
						zlib.inflate(body, decompress);
					} else if (encoding === 'gzip') {
						zlib.gunzip(body, decompress);
					} else {
						this.emit('body', response, body);
					}
				});
			}
		}).on('error', (error) => {
			this.emit('error', error);
		});

		// Pipe the data to the request
		// In Node 10+ use stream.pipeline()
		this.pipe(request);

		// Check if the request is being upgraded
		if (options.headers.Upgrade) {
			request.on('upgrade', (response, socket) => {
				this.emit('upgrade', response, socket);
			});
		}

		// Do not sent data for GET and HEAD requests
		if (method === 'get' || method === 'head') {
			this.end();
		}
	}

	// Send data, stringify non-string data
	send(data, callback) {

		// Stringify data which is not a buffer nor string
		if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
			data = JSON.stringify(data);
		}

		// Ensure that the callback is a function
		if (typeof callback !== 'function') {
			callback = null;
		}

		// Write the data and end the request
		this.end(data, callback);

		return this;
	}

	// Pipe the response to the destination
	stream(destination, options) {
		// In Node 10+ use stream.pipeline()
		this._response.pipe(destination, options);
	}

	// Client request factory method
	static create(method, location, options, callback) {

		return new ClientRequest(method, location, options, callback);
	}

	// Return a function for decompressing response body
	static decompress(request, response) {

		return (error, result) => {
			if (error) {
				request.emit('error', error);
			} else {
				request.emit('body', response, result);
			}
		};
	}
}

module.exports = ClientRequest;