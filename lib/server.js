var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');
var zlib = require('zlib');

var requestInterface = require('./request');
var responseInterface = require('./response');
var ws = require('./ws');

// Prepare the utilities for the server
var mimeTypes = JSON.parse(fs.readFileSync(__dirname + '/../utils/mime.json', 'utf8'));
var client = fs.readFileSync(__dirname + '/../utils/client.js', 'utf8');
var clientLastModified = new Date(fs.statSync(__dirname + '/../utils/client.js').mtime).valueOf();

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

		var host = this.hosts[request.headers.host] || this.hosts.main;

		// Link to the socket, for low level interaction
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

	// CORS limitation
	if (request.headers.origin && (request.headers.origin === 'null' || ~this.origins.indexOf(url.parse(request.headers.origin).hostname) || (this.origins[0] === '*' && !~this.origins.indexOf(url.parse(request.headers.origin).hostname)))) {
		response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	} else if (request.headers.origin) {
		response.setHeader('Access-Control-Allow-Origin', request.headers.host);
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

	this.routing(request, response, responseStream);
};

// Route the HTTP requests
server.prototype.routing = function (request, response, stream) {
	'use strict';

	var host = this.hosts[request.headers.host] || this.hosts.main;

	// Create the route interface
	var routeInterface = [
		new requestInterface(request, host),
		new responseInterface(request, response, stream, this)
	];

	// Set the value of the session
	response.setHeader('Set-Cookie', '_session=' + routeInterface[0].session._name + ';expires=' + new Date(new Date().valueOf() + 3600000).toUTCString() + ';path=/;domain=' + request.headers.host + ';httponly');

	// Routing requests
	var requestURL = url.parse(request.url).pathname;

	try {
		if (request.method === 'GET' || request.method === 'HEAD') {
			if (host.routes.get[requestURL]) {
				host.routes.get[requestURL].apply(null, routeInterface);
			} else if (host.routes.all[requestURL]) {
				host.routes.all[requestURL].apply(null, routeInterface);
			} else if (request.url === '/simples/client.js') {
				var notModified = Number(request.headers['if-modified-since']) === clientLastModified;
				var code = notModified ? 304 : 200;
				response.writeHead(code, {
					'Content-Type': 'application/javascript',
					'Last-Modified': clientLastModified
				});
				if (notModified) {
					response.end();
				} else {
					stream.end(client);
				}
			} else if (host.routes.serve) {

				// Routing static files
				var realPath = path.join(host.routes.serve, requestURL);
				fs.stat(realPath, function (error, stats) {
					if (!error && stats.isFile()) {
						var lastModified = new Date(stats.mtime).valueOf();
						var notModified = Number(request.headers['if-modified-since']) === lastModified;
						var code = notModified ? 304 : 200;
						response.writeHead(code, {
							'Content-Type': mimeTypes[path.extname(requestURL).slice(1)] || mimeTypes['default'],
							'Last-Modified': lastModified
						});
						if (notModified) {
							response.end();
						} else {
							fs.createReadStream(realPath).pipe(stream);
						}
					} else {
						response.statusCode = 404;
						host.routes.error[404].apply(null, routeInterface);
					}
				});
			} else {
				response.statusCode = 404;
				host.routes.error[404].apply(null, routeInterface);
			}
		} else if (request.method === 'POST') {

			// When request body is received
			request.on('end', function () {
				if (host.routes.post[requestURL]) {
					host.routes.post[requestURL].apply(null, routeInterface);
				} else if (host.routes.all[requestURL]) {
					host.routes.all[requestURL].apply(null, routeInterface);
				} else {
					response.statusCode = 404;
					host.routes.error[404].apply(null, routeInterface);
				}
			});
		} else {
			response.statusCode = 405;
			host.routes.error[405].apply(null, routeInterface);
		}
	} catch (error) {
		response.statusCode = 500;
		try {
			host.routes.error[500].apply(null, routeInterface);
		} catch (error) {
			stream.end('"' + request.url + '" Internal Server Error');
		}
		console.log('\nsimpleS: Internal Server Error on route "' + request.url + '"\n' + error.stack + '\n');
	}
};