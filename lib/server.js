var fs = require('fs');
var http = require('http');
var path = require('path');
var qs = require('querystring');
var url = require('url');

var cs = require('./compress_stream');
var mime = require('./mime');
var responseInterface = require('./response_interface');

function server() {

	'use strict';

	// Ignore new keyword
	if (!(this instanceof server)) {
		return new server();
	}

	http.Server.call(this, this.handle);

	// Initialize routes and WebSocket hosts
	this.routes = {
		all: {},
		get: {},
		getStatic: undefined,
		notFound: function (request, response) {
			response.end('"' + request.url.href + '" was not found');
		},
		post: {}
	};
	this.wsHosts = {};
}

// Inherit from http.Server
server.prototype = Object.create(http.Server.prototype, {
	constructor: {
		value: server,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Handle for the HTTP requests
server.prototype.handle = function (request, response) {

	// Redirect response for future compression
	var responseStream = response;
	responseStream.response = response;

	// Check for supported content encodings of the client
	var acceptEncoding = request.headers['accept-encoding'];
	var contentEncoding;
	if (acceptEncoding) {
		if (acceptEncoding.indexOf('deflate') >= 0) {
			contentEncoding = 'deflate';
		} else if (acceptEncoding.indexOf('gzip') >= 0) {
			contentEncoding = 'gzip';
		}
	}

	// Check for encoding for the response
	if (contentEncoding) {

		// Initialize compression stream and prepare the pipe for compression
		var compressStream = cs(contentEncoding);
		responseStream = compressStream;
		responseStream.response = response;
		responseStream.pipe(response);

		// Set content encoding
		response.setHeader('Content-Encoding', contentEncoding);
	}

	// The request interface available in callbacks
	var requestInterface = {

		// The content body of the request
		body: '',

		// Data about the client remote connection
		connection: {
			ip: request.connection.remoteAddress,
			port: request.connection.remotePort
		},

		// The cookies provided by the client
		get cookies() {
			if (request.headers.cookie) {
				return request.headers.cookie.split(/;\s*/).map(function (element) {
					var eq = element.indexOf('=');
					return {
						name: element.slice(0, eq).trim(),
						value: element.slice(eq + 1).trim()
					};
				});
			}
			return [];
		},

		// Files sent using POST method and multipart/form-data encoding
		files: {},

		// The headers of the request
		headers: request.headers,

		// The languages accepted by the client
		get langs() {
			if (request.headers['accept-language']) {
				return request.headers['accept-language'].split(/\s*,\s*/).map(function (element) {
					var value = element.split(/\s*;\s*/);
					return {
						lang: value[0],
						quality: value[1] ? Number(value[1].split(/\s*=\s*/)[1]) : 1
					};
				}).sort(function (first, second) {
					return second.quality - first.quality;
				}).map(function (element) {
					return element.lang;
				});
			}
			return [];
		},

		// The method of the request
		method: request.method,

		// The object containing queries from both GET and POST methods
		query: qs.parse(url.parse(request.url).query),

		// The components of the request url
		url: url.parse(request.url, true)
	};

	// Change the response interface available in callbacks
	response = responseInterface(responseStream);

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	if (request.method === 'GET') {
		if (this.routes.get[requestURL]) {
			this.routes.get[requestURL](requestInterface, response);
		} else if (this.routes.all[requestURL]) {
			this.routes.all[requestURL](requestInterface, response);
		} else if (this.routes.getStatic) {

			// Routing static files
			var realPath = path.join(this.routes.getStatic, requestURL);
			fs.stat(realPath, function (error, stats) {
				if (!error && stats.isFile()) {
					var lastModified = new Date(stats.mtime).valueOf();
					if (Number(request.headers['if-modified-since']) === lastModified) {
						response.statusCode = 304;
						response.end();
					} else {
						response.writeHead(200, {
							'Content-Type': mime(path.extname(realPath).slice(1)),
							'Last-Modified': lastModified
						});
						fs.createReadStream(realPath).pipe(responseStream);
					}
				} else {
					response.statusCode = 404;
					this.routes.notFound(requestInterface, response);
				}
			});
		} else {
			response.statusCode = 404;
			this.routes.notFound(requestInterface, response);
		}
	} else if (request.method === 'POST') {

		// Link to this context
		var that = this;

		// Prepare the request body
		request.on('data', function (data) {
			requestInterface.body += data.toString();
		});

		// When request body is received
		request.on('end', function () {
			var contentTypeHeader = request.headers['content-type'].split(/\s*;\s*/);
			var contentType = contentTypeHeader[0];
			if (contentType === 'application/x-www-form-urlencoded' || contentType === 'text/plain') {
				var POSTquery = qs.parse(requestInterface.body);
				Object.keys(POSTquery).forEach(function (element, index, array) {
					requestInterface.query[element] = POSTquery[element];
				});
			} else if (contentType === 'multipart/form-data') {
				var boundary = contentTypeHeader[1].slice(9);
				var items = requestInterface.body.split(RegExp('\r?\n?--' + boundary + '-?-?\r\n'));
				items.shift();
				items.pop();
				items.forEach(function (e, i, a) {
					e = e.slice(e.indexOf('name="') + 6);
					var name = e.substr(0, e.indexOf('"'));
					var fileNameIndex = e.indexOf('filename="');
					if (fileNameIndex >= 0) {
						e = e.slice(fileNameIndex + 10);
						var filename = e.substr(0, e.indexOf('"'));
						e = e.slice(e.indexOf('Content-Type: ') + 14);
						var type = e.substr(0, e.indexOf('\r'));
					}
					var content = e.slice(e.indexOf('\r\n\r\n') + 4);
					if (filename) {
						requestInterface.files[name] = {
							content: content,
							filename: filename,
							type: type
						}
					} else {
						requestInterface.query[name] = content;
					}
				});
			} else {
				response.statusCode = 400;
				response.end();
				return;
			}
			if (that.routes.post[requestURL]) {
				that.routes.post[requestURL](requestInterface, response);
			} else if (that.routes.all[requestURL]) {
				that.routes.all[requestURL](requestInterface, response);
			} else {
				response.statusCode = 404;
				that.routes.notFound(requestInterface, response);
			}
		});
	} else {
		response.statusCode = 405;
		response.end();	
	}
}

module.exports = server;