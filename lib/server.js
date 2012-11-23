var events = require('events');
var fs = require('fs');
var http = require('http');
var path = require('path');
var qs = require('querystring');
var url = require('url');
var zlib = require('zlib');

var mime = require('./mime');
var ws = require('./ws');

function requestInterface(request) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof requestInterface)) {
		return new requestInterface(request);
	}

	// Link to this context
	var that = this;

	// The content body of the request
	this.body = '';

	// Data about the client remote connection
	this.connection = {
		ip: request.connection.remoteAddress,
		port: request.connection.remotePort
	};

	// The cookies provided by the client
	this.cookies = {};

	// Files sent using POST method and multipart/form-data encoding
	this.files = {};

	// The headers of the request
	this.headers = request.headers;

	// The languages accepted by the client in the order of their importance
	this.langs = [];

	// The method of the request
	this.method = request.method;

	// The object containing queries from both GET and POST methods
	this.query = qs.parse(url.parse(request.url).query);

	this.session = null;

	// The components of the request url
	this.url = url.parse(request.url, true);

	// Only for POST requests populate the body, the files and the query
	if (request.method === 'POST') {

		// Populate the body of the request
		request.on('data', function (data) {
			that.body += data.toString();
		});

		// Populate the files and the query
		request.on('end', function () {
			var contentTypeHeader = request.headers['content-type'].split(/\s*;\s*/);
			var contentType = contentTypeHeader[0];
			if (contentType === 'multipart/form-data') {
				var boundary = contentTypeHeader[1].slice(9);
				var items = this.body.split(RegExp('\r?\n?--' + boundary + '-?-?\r\n'));
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
						that.files[name] = {
							content: content,
							filename: filename,
							type: type
						}
					} else {
						that.query[name] = content;
					}
				});
			} else {
				var POSTquery = qs.parse(this.body);
				Object.keys(POSTquery).forEach(function (element) {
					that.query[element] = POSTquery[element];
				});
			}
		});
	}

	// Populate the cookies and the session
	if (request.headers.cookie) {
		request.headers.cookie.split(/\s*;\s*/).forEach(function (element) {
			var eq = element.indexOf('=');
			var name = element.slice(0, eq).trim();
			var value = element.slice(eq + 1).trim();
			if (name === '_session') {
				that.session = request.server.sessions[value];
			} else {
				that.cookies[name] = value;
			}
		});
	}
	
	// Generate or prolong session
	if (!this.session) {
		var keys = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		var name = keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)] +
			keys[Math.round(Math.random() * 61)];
		request.server.sessions[name] = {
			_name: name,
			_timeout: setTimeout(function () {
				delete request.server.sessions[name];
			}, 3600000)
		};
		this.session = request.server.sessions[name];
		
	} else {
		clearTimeout(this.session._timeout);
		this.session._timeout = setTimeout(function () {
			delete request.server.sessions[that.session._name];
		}, 3600000);
	}

	// Populate the languages accepted by the client
	if (request.headers['accept-language']) {
		this.langs = request.headers['accept-language'].split(/\s*,\s*/).map(function (element) {
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
}

function responseInterface(responseStream) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof responseInterface)) {
		return new responseInterface(responseStream);
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Linking the response and the stream
	this._response = responseStream.response;
	this._stream = responseStream;

	// Can be used as a writable stream
	this.writable = true;

	var that = this;
	this._stream.on('close', function () {
		that.emit('close');
	});
	this._stream.on('drain', function () {
		that.emit('drain');
	});
	this._stream.on('end', function () {
		that.emit('end');
	});
	this._stream.on('error', function (error) {
		that.emit('error', error);
	});

	// Setting the default content type to html
	this._response.setHeader('Content-Type', 'text/html;charset=utf-8');
}

// Inherit from events.EventEmitter
responseInterface.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: responseInterface,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Set the cookie with specific options (expires, max-age, path, domain, secure, httponly)
responseInterface.prototype.cookie = function (name, value, config) {
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
			cookie += ';path=/';
		}

		if (config.domain) {
			cookie += ';domain=' + config.domain;
		} else {
			cookie += ';domain=' + request.headers.host;
		}

		// For future https implementation
		/*if (config.secure) {
			cookie += ';secure';
		}*/

		if (config.httpOnly) {
			cookie += ';httponly';
		}
	}

	this._response.setHeader('Set-Cookie', this._response.getHeader('Set-Cookie') + '\r' + cookie);
};

// End response stream
responseInterface.prototype.end = function (data) {
	this._stream.end(data);
};

// Set the language of the content of the response
responseInterface.prototype.lang = function (lang) {
	this._response.setHeader('Content-Language', lang);
};

// Redirect the client
responseInterface.prototype.redirect = function (path) {
	this._response.writeHead(302, {
		'Location':	path
	});
	this._response.end();
};

// Set cookie expiration time in past
responseInterface.prototype.removeCookie = function (name) {
	this.cookie(name, '', {
		expires: new Date().toUTCString()
	});
};

// Send preformatted data to the response stream
responseInterface.prototype.send = function (data) {

	// Transform data to Buffer and writes it to the stream
	if (!(data instanceof Buffer)) {
		if (typeof data !== 'string' && !(data instanceof String)) {
			data = JSON.stringify(data);
		}

		data = Buffer(data);
	}

	this._stream.write(data);
	this._stream.end();
};

// Set the type of the content of the response
responseInterface.prototype.type = function (type) {
	this._response.setHeader('Content-Type', mime(type));
};

// Write to response stream
responseInterface.prototype.write = function (data) {
	this._stream.write(data);
};

module.exports = server = function () {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof server)) {
		return new server();
	}

	// Call http.Server in this context
	http.Server.call(this, this.handle);

	// Initialize origins, routes and WebSocket hosts
	this.origins = [];
	this.routes = {
		all: {},
		error: {

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
	this.sessions = {};
	this.wsHosts = {};

	var that = this;

	// Listen for WebSocket connections
	this.on('upgrade', function (request, socket, head) {

		// Link to the socket, for low level interaction
		request.server = that;
		request = requestInterface(request);
		request.socket = socket;

		// Handle for WebSocket requests
		ws(request, this.wsHosts[request.url.path]);
	});
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

	// Link to this context
	var that = this;

	// Link to the response and define the route interface
	request.server = this;
	responseStream.response = response;
	var reqI = requestInterface(request);
	var resI = responseInterface(responseStream);
	response.setHeader('Set-Cookie', '_session=' + reqI.session._name + ';expires=' + new Date(new Date().valueOf() + 3600000).toUTCString() + ';path=/;domain=' + request.headers.host + ';httponly');
	var routeInterface = [
		reqI,
		resI
	];

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	if (this.origins[0] === '*' || request.headers.host !== request.headers.origin && this.origins.indexOf(request.headers.origin) >= 0) {
		response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	} else if (request.headers.origin) {
		response.setHeader('Access-Control-Allow-Origin', request.headers.host);
	}
	try {
		if (request.method === 'GET') {
			if (this.routes.get[requestURL]) {
				this.routes.get[requestURL].apply(null, routeInterface);
			} else if (this.routes.all[requestURL]) {
				this.routes.all[requestURL].apply(null, routeInterface);
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
						that.routes.error[404].apply(null, routeInterface);
					}
				});
			} else {
				response.statusCode = 404;
				this.routes.error[404].apply(null, routeInterface);
			}
		} else if (request.method === 'POST') {

			// When request body is received
			request.on('end', function () {
				if (that.routes.post[requestURL]) {
					that.routes.post[requestURL].apply(null, routeInterface);
				} else if (that.routes.all[requestURL]) {
					that.routes.all[requestURL].apply(null, routeInterface);
				} else {
					response.statusCode = 404;
					that.routes.error[404].apply(null, routeInterface);
				}
			});
		} else if (request.method === 'HEAD' || request.method === 'OPTIONS') {
			response.end();
		} else {
			response.statusCode = 405;
			this.routes.error[405].apply(null, routeInterface);
		}
	} catch (error) {
		response.statusCode = 500;
		this.routes.error[500].apply(null, routeInterface);
		console.log('\nsimpleS: Internal Server Error\n' + error + '\n');
	}
};