'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const zlib = require('zlib');

const { PassThrough, Transform } = require('stream');

class ClientRequest extends Transform {

	constructor(method, location, options) {

		let request = null;

		super();

		// Create a response stream
		this.response = PassThrough();

		// Make method to be lowercased for comparison
		method = method.toLowerCase();

		// Parse the location to obtain the location object
		location = url.parse(location);

		// Prepare options object
		options = Object.assign({}, options, {
			headers: Object.assign({}, options.headers),
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
			response.pipe(this.response);

			// Emit the response event
			this.emit('response', response);

			// Listen for response errors
			response.on('error', (error) => {
				this.emit('error', error);
			});

			// Check for body event listeners and process the received data
			if (this.listeners('body').length) {
				response.on('data', (data) => {
					length += data.length;
					body = Buffer.concat([body, data], length);
				}).on('end', () => {
					if (encoding === 'deflate') {
						zlib.inflate(body, (error, result) => {
							if (error) {
								this.emit('error', error);
							} else {
								this.emit('body', response, result);
							}
						});
					} else if (encoding === 'gzip') {
						zlib.gunzip(body, (error, result) => {
							if (error) {
								this.emit('error', error);
							} else {
								this.emit('body', response, result);
							}
						});
					} else {
						this.emit('body', response, body);
					}
				});
			}
		});

		// Set a listener for errors on the request
		request.on('error', (error) => {
			this.emit('error', error);
		});

		// Pipe the data to the request
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
	send(data, replacer, space) {

		// Stringify data which is not a buffer nor string
		if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
			data = JSON.stringify(data, replacer, space);
		}

		// Write the data and end the request
		this.end(data);

		return this;
	}

	// Client request factory method
	static create(method, location, options) {

		return new ClientRequest(method, location, options);
	}
}

module.exports = ClientRequest;