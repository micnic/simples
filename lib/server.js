var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');

var cs = require('./compress_stream.js');
var mime = require('./mime.js');

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
		post: {},
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
		responseStream.pipe(response);

		// Set content encoding
		response.setHeader('Content-Encoding', contentEncoding);
	}

	// The request interface available in callbacks
	var requestInterface = {

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

		// The provided query object
		query: require('querystring').parse('TODO:REQUEST.BODY'),

		// The components of the request url
		url: url.parse(request.url, true)
	};

	// The response interface available in callbacks
	var typeSet = false;
	var responseInterface = {

		// Set the cookie with specific options (expires, max-age, path, domain, secure, httponly)
		cookie: function (name, value, config) {
			var cookie = name + '=' + value;

			if (config) {
				if (config.expires) {
					cookie += ';expires=' + new Date(config.expires).toUTCString();
				}

				if (config.maxAge) {
					cookie += ';max-age=' + config.maxAge;
				}

				if (config.path) {
					cookie += ';path=' + config.path;
				} else {
					cookie += ';path=' + '/';
				}

				if (config.domain) {
					cookie += ';domain=' + config.domain;
				} else {
					cookie += ';domain=' + request.headers['host'];
				}

				// For future https implementation
				if (config.secure) {
					cookie += ';secure';
				}

				if (config.httpOnly) {
					cookie += ';httponly';
				}
			}

			if (response.getHeader('Set-Cookie')) {
				response.setHeader('Set-Cookie', response.getHeader('Set-Cookie') + '\r' + cookie);
			} else {
				response.setHeader('Set-Cookie', cookie);
			}
		},

		// Force to download the file
		download: function (filename) {
			response.setHeader('Content-Disposition', 'attachment;filename=' + '"' + filename + '"');
			response.end();
		},

		// End response stream
		end: function (data) {
			if (data) {
				this.write(data);
			}
			responseStream.end();
		},

		// Set the language of the content of the response
		lang: function (lang) {
			response.setHeader('Content-Language', lang);
		},

		// Redirect the client
		redirect: function (path) {
			response.writeHead(302, {
				'Location':	path
			});
			response.end();
		},

		// Set cookie expiration time in past
		removeCookie: function (name) {
			this.cookie(name, '', {expires: new Date().toUTCString()});
		},

		// Set the type of the content of the response
		type: function (type) {
			typeSet = true;
			response.setHeader('Content-Type', mime(type));
		},

		// Write to response stream
		write: function (data) {
			if (!typeSet) {
				typeSet = true;
				response.setHeader('Content-Type', 'text/html;charset=utf-8');
			}
			responseStream.write(data);
		}
	};

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	if (request.method === 'GET') {
		if (this.routes.get[requestURL]) {
			this.routes.get[requestURL](requestInterface, responseInterface);
		} else if (this.routes.all[requestURL]) {
			this.routes.all[requestURL](requestInterface, responseInterface);
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
					this.routes.notFound(requestInterface, responseInterface);
				}
			});
		} else {
			response.statusCode = 404;
			this.routes.notFound(requestInterface, responseInterface);
		}
	} else if (request.method === 'POST') {
		if (this.routes.post[requestURL]) {
			this.routes.post[requestURL](requestInterface, responseInterface);
		} else if (this.routes.all[requestURL]) {
			this.routes.all[requestURL](requestInterface, responseInterface);
		} else {
			response.statusCode = 404;
			this.routes.notFound(requestInterface, responseInterface);
		}
	}
}

module.exports = server;