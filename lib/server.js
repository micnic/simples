var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');
var zlib = require('zlib');

var requestInterface = require('./request');
var responseInterface = require('./response');
var ws = require('./ws');

// Prepare the utilities for the server
var mimeTypes = responseInterface.mimeTypes;
var client = fs.readFileSync(__dirname + '/../utils/client.js', 'utf8');
var clientLastModified = fs.statSync(__dirname + '/../utils/client.js').mtime.valueOf();

// Server prototype constructor
var server = module.exports = function (hosts) {
	'use strict';

	// Call http.Server in this context
	http.Server.call(this, this.handle);

	// The method from the template engine to render the response
	this.render = null;
	
	// Initialize origins, routes and WebSocket hosts
	this.hosts = hosts;

	// Listen for WebSocket connections
	this.on('upgrade', function (request, socket) {

		socket.setTimeout(25000);

		var hostname = request.headers.host;
		var index = hostname.indexOf(':');
		if (index > 0) {
			hostname = hostname.substring(0, index);
		}
		var host = this.hosts[hostname] || this.hosts.main;
		request = new requestInterface(request, host);

		// Handle for WebSocket requests
		ws.call(host, request, socket, host.wsHosts[request.url.path]);
	}.bind(this));
};

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
	'use strict';

	var hostname = request.headers.host;
	var index = hostname.indexOf(':');
	if (index > 0) {
		hostname = hostname.substring(0, index);
	}
	var host = this.hosts[hostname] || this.hosts.main;

	// CORS limitation
	if (request.headers.origin) {
		var origin = request.headers.origin;
		index = origin.indexOf(':');
		if (index > 0) {
			origin = origin.substring(0, index);
		}
		if (origin === 'null' || ~host.origins.indexOf(origin) || (host.origins[0] === '*' && !~host.origins.indexOf(origin))) {
			response.setHeader('Access-Control-Allow-Origin', origin);
			response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		} else {
			response.setHeader('Access-Control-Allow-Origin', hostname);
		}
	}

	// Check for cross-origin options request
	if (request.method === 'OPTIONS') {
		response.end();
		return;
	}

	// Check for supported content encodings of the client
	var acceptEncoding = request.headers['accept-encoding'];
	var contentEncoding;
	if (acceptEncoding) {
		if (~acceptEncoding.indexOf('deflate')) {
			contentEncoding = 'Deflate';
		} else if (~acceptEncoding.indexOf('gzip')) {
			contentEncoding = 'Gzip';
		}
	}

	// Prepare the response stream
	var responseStream;
	if (contentEncoding) {

		// Set content encoding and initialize compression stream
		response.setHeader('Content-Encoding', contentEncoding);
		responseStream = zlib['create' + contentEncoding]();
		responseStream.pipe(response);
	} else {
		responseStream = response;
	}

	this.routing(request, response, responseStream, host);
};

// Route the HTTP requests
server.prototype.routing = function (request, response, stream, host) {
	'use strict';

	// Create the route interface
	var routeInterface = [
		new requestInterface(request, host),
		new responseInterface(request, response, stream, this)
	];

	// Set the value of the session
	var domain = host.name;
	if (!domain) {
		domain = request.headers.host;
		var index = domain.indexOf(':');
		if (index > 0) {
			domain = domain.substring(0, index);
		}
	}
	response.setHeader('Set-Cookie', '_session=' + routeInterface[0].session._name + ';expires=' + new Date(new Date().valueOf() + 3600000).toUTCString() + ';path=/;domain=' + domain + ';httponly');

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	var routes = host.routes;

	try {
		if (request.method === 'GET' || request.method === 'HEAD') {
			if (routes.get[requestURL]) {
				routes.get[requestURL].apply(null, routeInterface);
			} else if (routes.all[requestURL]) {
				routes.all[requestURL].apply(null, routeInterface);
			} else if (request.url === '/simples/client.js') {
				var notModified = Number(request.headers['if-modified-since']) === clientLastModified;
				var code;
				if (notModified) {
					code = 304;
				} else {
					code = 200;
				}
				response.writeHead(code, {
					'Content-Type': 'application/javascript',
					'Last-Modified': clientLastModified
				});
				if (notModified) {
					response.end();
				} else {
					stream.end(client);
				}
			} else if (routes.serve.path) {

				// Routing static files
				var realPath = path.join(routes.serve.path, requestURL);
				fs.stat(realPath, function (error, stats) {
					if (!error && stats.isFile()) {
						var lastModified = stats.mtime.valueOf();
						var notModified = Number(request.headers['if-modified-since']) === lastModified;
						var code;
						if (notModified) {
							code = 304;
						} else {
							code = 200;
						}
						response.writeHead(code, {
							'Content-Type': mimeTypes[path.extname(requestURL).substr(1)] || mimeTypes['default'],
							'Last-Modified': lastModified
						});
						if (notModified) {
							response.end();
						} else {
							fs.createReadStream(realPath).pipe(stream);
						}
					} else if (!error && routes.serve.callback && stats.isDirectory()) {
						routes.serve.callback.apply(null, routeInterface);
					} else {
						response.statusCode = 404;
						routes.error[404].apply(null, routeInterface);
					}
				});
			} else {
				response.statusCode = 404;
				routes.error[404].apply(null, routeInterface);
			}
		} else if (request.method === 'POST') {

			// When request body is received
			request.on('end', function () {
				if (routes.post[requestURL]) {
					routes.post[requestURL].apply(null, routeInterface);
				} else if (routes.all[requestURL]) {
					routes.all[requestURL].apply(null, routeInterface);
				} else {
					response.statusCode = 404;
					routes.error[404].apply(null, routeInterface);
				}
			});
		} else {
			response.statusCode = 405;
			routes.error[405].apply(null, routeInterface);
		}
	} catch (error) {
		response.statusCode = 500;
		try {
			routes.error[500].apply(null, routeInterface);
		} catch (error) {
			stream.end('"' + request.url + '" Internal Server Error');
		}
		console.log('\nsimpleS: Internal Server Error on route "' + request.url + '"\n' + error.stack + '\n');
	}
};