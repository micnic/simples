var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');
var zlib = require('zlib');

var requestInterface = require('./request');
var responseInterface = require('./response');
var ws = require('./ws');

// Prepare the mime types
var mimeTypes = responseInterface.mimeTypes;

// Server prototype constructor
var server = module.exports = function (hosts) {
	'use strict';

	// Call http.Server in this context
	http.Server.call(this, this.handle);

	// Shortcut to this context
	var that = this;

	// The method from the template engine to render the response
	this.render = null;
	
	// The hosts of the server
	this.hosts = hosts;

	// Listen for upgrade connections dedicated for WebSocket
	this.on('upgrade', function (request, socket) {

		// Set socket keep alive time to 25 seconds
		socket.setTimeout(25000);

		// Prepare data for WebSocket host
		var hostname = request.headers.host;
		var index = hostname.indexOf(':');

		// Remove the port from the hostname
		if (index > 0) {
			hostname = hostname.substring(0, index);
		}

		var host = that.hosts[hostname] || that.hosts.main;
		request = new requestInterface(request, host);

		// Handle for WebSocket requests
		ws.call(host, request, socket, host.wsHosts[request.url.path]);
	});
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

	var headers = request.headers;
	var hostname = headers.host;
	var index = hostname.indexOf(':');
	if (index > 0) {
		hostname = hostname.substring(0, index);
	}
	var host;
	if (this.hosts[hostname] && this.hosts[hostname].started) {
		host = this.hosts[hostname];
	} else {
		 host = this.hosts.main;
	}

	// CORS limitation
	if (headers.origin) {
		var origin = headers.origin;
		index = origin.indexOf(':');
		if (index > 0) {
			origin = origin.substring(0, index);
		}
		index = ~host.origins.indexOf(origin);
		if (origin === 'null' || index || host.origins[0] === '*' && !index) {
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
	var acceptEncoding = headers['accept-encoding'];
	var contentEncoding;
	if (acceptEncoding) {
		if (~acceptEncoding.indexOf('deflate')) {
			contentEncoding = 'Deflate';
		} else if (~acceptEncoding.indexOf('gzip')) {
			contentEncoding = 'Gzip';
		}
	}

	// Prepare the response stream
	var stream;
	if (contentEncoding) {

		// Set content encoding and initialize compression stream
		response.setHeader('Content-Encoding', contentEncoding);
		stream = zlib['create' + contentEncoding]();
		stream.pipe(response);
	} else {
		stream = response;
	}

	// Create the route interface
	var routeInterface = [
		new requestInterface(request, host),
		new responseInterface(request, response, stream, this)
	];

	// Set the value of the session
	var domain = hostname;
	if (!domain) {
		domain = headers.host;
		index = domain.indexOf(':');
		if (index > 0) {
			domain = domain.substring(0, index);
		}
		if (domain === 'localhost') {
			domain = '';
		}
	}
	var sessionTimeToLive = new Date().valueOf() + 3600000;

	// Prepare the session
	// TODO: use the session only if it's running out of time
	var session = '_session=' + routeInterface[0].session._name;
	session += ';expires=' + new Date(sessionTimeToLive).toUTCString();
	session += ';path=/;domain=' + domain + ';httponly';
	response.setHeader('Set-Cookie', session);

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	var routes = host.routes;

	// Route GET requests
	function getRouting() {
		if (routes.get[requestURL]) {
			routes.get[requestURL].apply(null, routeInterface);
		} else if (routes.all[requestURL]) {
			routes.all[requestURL].apply(null, routeInterface);
		} else if (routes.serve.path || requestURL === '/simples/client.js') {
			staticRouting();
		} else {
			response.statusCode = 404;
			routes.error[404].apply(null, routeInterface);
		}
	}

	// Route POST requests
	function postRouting() {

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
	}

	// Route static files
	function staticRouting() {
		var realPath;
		if (requestURL === '/simples/client.js') {
			realPath = __dirname + '/../utils/client.js';
		} else {
			realPath = path.join(routes.serve.path, requestURL);
		}
		fs.stat(realPath, function (error, stats) {
			if (!error && stats.isFile()) {
				var extension = path.extname(requestURL).substr(1);
				var lastModified = stats.mtime.valueOf();
				var ifModifiedSince = Number(headers['if-modified-since']);
				var notModified = ifModifiedSince === lastModified;
				var contentType = mimeTypes[extension] || mimeTypes['default'];
				var code;
				if (notModified) {
					code = 304;
				} else {
					code = 200;
				}
				response.writeHead(code, {
					'Content-Type': contentType,
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
	}

	// All requests routing
	function routing() {
		if (request.method === 'GET' || request.method === 'HEAD') {
			getRouting();
		} else if (request.method === 'POST') {
			postRouting();
		} else {
			response.statusCode = 405;
			routes.error[405].apply(null, routeInterface);
		}
	}

	// Vulnerable code handling
	try {
		routing();
	} catch (error) {
		console.log('simpleS: Internal Server Error > "' + request.url + '"');
		console.log(error.stack + '\n');
		response.statusCode = 500;
		try {
			routes.error[500].apply(null, routeInterface);
		} catch (error) {
			console.log('simpleS: can not apply route for error 500');
			console.log(error.stack + '\n');
			stream.destroy();
		}
		
	}
};