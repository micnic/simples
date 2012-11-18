var fs = require('fs');
var http = require('http');
var path = require('path');
var qs = require('querystring');
var url = require('url');
var zlib = require('zlib');

var mime = require('./mime');
var ri = require('./response_interface');

function server() {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof server)) {
		return new server();
	}

	// Call http.Server in this context
	http.Server.call(this, this.handle);

	// Initialize routes and WebSocket hosts
	this.routes = {
		all: {},
		error: {

			// Bad Request
			400: function (request, response) {
				response.end(http.STATUS_CODES[400]);
			},

			// Not Found
			404: function (request, response) {
				response.end(http.STATUS_CODES[404]);
			},

			// Method Not Allowed
			405: function (request, response) {
				response.end(http.STATUS_CODES[405]);
			},

			// Internal Server Error
			500: function (request, response) {
				response.end(http.STATUS_CODES[500]);
			}
		},
		get: {},
		post: {},
		serve: undefined,
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

	// Check for supported content encodings of the client
	var acceptEncoding = request.headers['accept-encoding'];
	var contentEncoding;
	if (acceptEncoding) {
		if (acceptEncoding.indexOf('deflate') >= 0) {
			contentEncoding = 'Deflate';
		} else if (acceptEncoding.indexOf('gzip') >= 0) {
			contentEncoding = 'Gzip';
		}
	}

	// Check for content encoding for the response
	var responseStream;
	if (contentEncoding) {

		// Set content encoding
		response.setHeader('Content-Encoding', contentEncoding);

		// Initialize compression stream and prepare the pipe for compression
		responseStream = zlib['create' + contentEncoding]();
		responseStream.pipe(response);
	} else {
		responseStream = response;
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
			var result = {};
			if (request.headers.cookie) {
				request.headers.cookie.split(/\s*;\s*/).forEach(function (element) {
					var eq = element.indexOf('=');
					var name = element.slice(0, eq).trim();
					var value = element.slice(eq + 1).trim();
					result[name] = value;
				});
			}
			return result;
		},

		// Files sent using POST method and multipart/form-data encoding
		files: {},

		// The headers of the request
		headers: request.headers,

		// The languages accepted by the client in the order of their importance
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

	// Link to the response and define the response interface
	responseStream.response = response;
	responseInterface = ri(responseStream);

	// Link to this context
	var that = this;

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	try {
		if (request.method === 'GET') {
			if (this.routes.get[requestURL]) {
				this.routes.get[requestURL].call(null, requestInterface, responseInterface);
			} else if (this.routes.all[requestURL]) {
				this.routes.all[requestURL].call(null, requestInterface, responseInterface);
			} else if (this.routes.serve) {

				// Routing static files
				var realPath = path.join(this.routes.serve, requestURL);
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
						that.routes.error[404].call(null, requestInterface, responseInterface);
					}
				});
			} else {
				response.statusCode = 404;
				this.routes.error[404].call(null, requestInterface, responseInterface);
			}
		} else if (request.method === 'POST') {

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
					Object.keys(POSTquery).forEach(function (element) {
						requestInterface.query[element] = POSTquery[element];
					});
				} else if (contentType === 'multipart/form-data') {
					var boundary = contentTypeHeader[1].slice(9);
					var items = requestInterface.body.split(RegExp('\r?\n?--' + boundary + '-?-?\r\n'));
					items.shift();
					items.pop();
					items.forEach(function (element) {
						element = element.slice(element.indexOf('name="') + 6);
						var name = element.substr(0, element.indexOf('"'));
						var fileNameIndex = element.indexOf('filename="');
						if (fileNameIndex >= 0) {
							element = element.slice(fileNameIndex + 10);
							var filename = element.substr(0, element.indexOf('"'));
							element = element.slice(element.indexOf('Content-Type: ') + 14);
							var type = element.substr(0, element.indexOf('\r'));
						}
						var content = element.slice(element.indexOf('\r\n\r\n') + 4);
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
					that.routes.error[400].call(null, requestInterface, responseInterface);
					return;
				}
				if (that.routes.post[requestURL]) {
					that.routes.post[requestURL].call(null, requestInterface, responseInterface);
				} else if (that.routes.all[requestURL]) {
					that.routes.all[requestURL].call(null, requestInterface, responseInterface);
				} else {
					response.statusCode = 404;
					that.routes.error[404].call(null, requestInterface, responseInterface);
				}
			});
		} else {
			response.statusCode = 405;
			this.routes.error[405].call(null, requestInterface, responseInterface);
		}
	} catch (error) {
		response.statusCode = 500;
		this.routes.error[500].call(null, requestInterface, responseInterface);
		console.log('\nsimpleS: Internal Server Error\n' + error + '\n');
	}
}

module.exports = server;