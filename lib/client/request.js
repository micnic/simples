'use strict';

var http = require('http'),
	https = require('https'),
	stream = require('stream'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	zlib = require('zlib');

// HTTP request prototype constructor
var ClientRequest = function (method, location, options) {

	var request = null,
		that = this;

	// General error listener
	function errorListener(error) {
		that.emit('error', error);
	}

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Create a response stream
	Object.defineProperty(this, 'response', {
		value: stream.PassThrough()
	});

	// Make method to be lowercased for comparison
	method = method.toLowerCase();

	// Parse the location to obtain the location object
	location = url.parse(location);

	// Prepare options object
	options = utils.assign({}, options, {
		headers: utils.assign({}, options.headers),
		host: location.host,
		hostname: location.hostname,
		method: method,
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
	request.on('response', function (response) {

		var body = Buffer(0),
			encoding = '';

		// Response listener for decompressed result
		function onDecompress(error, result) {
			if (error) {
				that.emit('error', error);
			} else {
				that.emit('body', response, result);
			}
		}

		// Check for content encoding
		if (response.headers['content-encoding']) {
			encoding = response.headers['content-encoding'].toLowerCase();
		}

		// Pipe the response to the external response
		response.pipe(that.response);

		// Emit the response event
		that.emit('response', response);

		// Listen for response errors
		response.on('error', errorListener);

		// Check for body event listeners and process the received data
		if (that.listeners('body').length) {
			response.on('data', function (data) {
				body = Buffer.concat([body, data], body.length + data.length);
			}).on('end', function () {
				if (encoding === 'deflate') {
					zlib.inflate(body, onDecompress);
				} else if (encoding === 'gzip') {
					zlib.gunzip(body, onDecompress);
				} else {
					that.emit('body', response, body);
				}
			});
		}
	});

	// Set a listener for errors on the request
	request.on('error', errorListener);

	// Pipe the data to the request
	this.pipe(request);

	// Check if the request is being upgraded
	if (options.headers.Upgrade) {
		request.on('upgrade', function (response, socket) {
			that.emit('upgrade', response, socket);
		});
	}

	// Do not sent data for GET and HEAD requests
	if (method === 'get' || method === 'head') {
		this.end();
	}
};

// Client request factory function
ClientRequest.create = function (method, location, options) {

	return new ClientRequest(method, location, options);
};

// Inherit from stream.PassThrough
ClientRequest.prototype = Object.create(stream.PassThrough.prototype, {
	constructor: {
		value: ClientRequest
	}
});

// Send data, stringify non-string data
ClientRequest.prototype.send = function (data, replacer, space) {

	// Stringify data which is not a buffer nor string
	if (!Buffer.isBuffer(data) && typeof data !== 'string') {
		data = JSON.stringify(data, replacer, space);
	}

	// Write the data and end the request
	this.end(data);

	return this;
};

module.exports = ClientRequest;