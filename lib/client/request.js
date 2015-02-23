'use strict';

var http = require('http'),
	https = require('https'),
	stream = require('stream'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	zlib = require('zlib');

// HTTP request prototype constructor
var request = function (client, method, location) {

	var options = {},
		requester = http.request,
		that = this;

	// General error listener
	function onError(error) {
		that.emit('error', error);
	}

	// Request listener for received response
	function onResponse(response) {

		var body = new Buffer(0),
			encoding = '';

		// Response listener for decompressed result
		function onDecompress(error, result) {
			if (error) {
				that.emit('error', error);
			} else {
				that.emit('body', response, result);
			}
		}

		// Response listener for end event
		function onEnd() {
			if (encoding === 'deflate') {
				zlib.inflate(body, onDecompress);
			} else if (encoding === 'gzip') {
				zlib.gunzip(body, onDecompress);
			} else {
				that.emit('body', response, body);
			}
		}

		// Response listener for readable event
		function onReadable() {

			var data = response.read() || new Buffer(0);

			body = Buffer.concat([body, data], body.length + data.length);
		}

		// Check for content encoding
		if (response.headers['content-encoding']) {
			encoding = response.headers['content-encoding'].toLowerCase();
		}

		// Emit the response event
		that.emit('response', response);

		// Listen for response errors
		response.on('error', onError);

		// Check for body event listeners and process the received data
		if (that.listeners('body').length) {
			response.on('readable', onReadable).on('end', onEnd);
		}
	}

	// Call stream.Transform in this context
	stream.Transform.call(this);

	// Make method to be lowercased for comparison
	method = method.toLowerCase();

	// Parse the location to obtain the location object
	location = url.parse(location);

	// Prepare options members
	options.headers = {};
	options.host = location.host;
	options.hostname = location.hostname;
	options.method = method;
	options.path = location.path;
	options.port = location.port;

	// Define private properties for request
	Object.defineProperties(this, {
		client: {
			value: client
		},
		data: {
			value: []
		},
		options: {
			value: options
		},
		requester: {
			value: null,
			writable: true
		}
	});

	// Check for the used protocol
	if (location.protocol === 'https:') {
		requester = https.request;
	}

	// Make the request in the next loop to be able to set the options
	setImmediate(function () {

		// Create the requester
		that.requester = requester(options, onResponse);

		// Set a listener for errors on the requester
		that.requester.on('error', onError);

		// Pipe the data to the requester
		that.pipe(that.requester);

		// Check if the request is being upgraded
		if (options.headers.Upgrade) {
			that.requester.on('upgrade', function (response, socket) {
				that.emit('upgrade', response, socket);
			});
		}

		// Do not sent data for GET and HEAD requests
		if (method === 'get' || method === 'head') {
			that.end();
		} else if (that.data.length) {
			that.data.forEach(function (chunk) {
				that.requester.write(chunk);
			});
		}
	});
};

// Inherit from stream.Transform
request.prototype = Object.create(stream.Transform.prototype, {
	constructor: {
		value: request
	}
});

// Transform method implementation
request.prototype._transform = function (chunk, encoding, callback) {

	// Check if the requester is already ready to push data
	if (this.requester) {
		this.push(chunk);
	} else {
		this.data.push(chunk);
	}

	// End the current transform
	callback();
};

// Set additional options
request.prototype.config = function (options) {

	// Set only the defined options
	utils.setOptions(this, options);

	return this;
};

// Send data, stringify non-string data
request.prototype.send = function (data, replacer, space) {

	// Stringify data which is not a buffer nor string
	if (!Buffer.isBuffer(data) && typeof data !== 'string') {
		data = JSON.stringify(data, replacer, space);
	}

	// Write the data and end the request
	this.end(data);
};

module.exports = request;