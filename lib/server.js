var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');
var zlib = require('zlib');

var requestInterface = require('./request');
var responseInterface = require('./response');
var ws = require('./ws');

var mimeTypes = require('../utils/mime');

// Server prototype constructor
var server = module.exports = function (hosts) {
	'use strict';

	// Call http.Server in this context
	http.Server.call(this, this.handle);

	// Container for caching static files content
	this.cache = {};

	// The hosts of the server
	this.hosts = hosts;

	// Listen for upgrade connections dedicated for WebSocket
	this.on('upgrade', ws);
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

// Handle for static files content cache
server.prototype.cacher = function (path, stream) {
	'use strict';
	
	var index = 0;
	var that = this;

	// Read 64kB pieces from cache
	function read() {
		if (that.cache[path].length - index > 65536) {
			stream.write(that.cache[path].slice(index, index += 65536));
			process.nextTick(read);
		} else {
			stream.end(that.cache[path].slice(index));
		}
	}

	if (this.cache[path]) {
		read();
	} else {

		this.cache[path] = Buffer(0);

		// Watch file changes for dynamic caching
		fs.watch(path, {
			persistent: false
		}, function (event, filename) {
			if (event === 'change') {
				fs.readFile(path, function (error, content) {

					// If the file can not be read
					if (error) {
						console.log('simpleS: can not cache "' + path + '"');
						delete that.cache[path];
						return;
					}

					that.cache[path] = content;
				});
			} else if (event === 'rename') {
				this.close();
				delete that.cache[path];
			}
		});

		// Stream the data to the cache and the response
		fs.ReadStream(path).on('data', function (data) {
			that.cache[path] = Buffer.concat([that.cache[path], data]);
			stream.write(data);
		}).on('end', function () {
			stream.end();
		});
	}
};

// Handle for the HTTP requests
server.prototype.handle = function (request, response) {
	'use strict';

	var that = this;
	var headers = request.headers;
	var hostname = headers.host;
	var index = hostname.indexOf(':');
	if (index > 0) {
		hostname = hostname.substring(0, index);
	}

	// Get the host
	var host;
	if (this.hosts[hostname] && this.hosts[hostname].started) {
		host = this.hosts[hostname];
	} else {
		host = this.hosts.main;
	}

	// CORS limitation
	if (headers.origin) {
		var origin = headers.origin;
		index = ~host.origins.indexOf(origin);
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		response.setHeader('Access-Control-Allow-Methods', 'GET,POST');

		// Check for accepted origins
		if (index || host.origins[0] === '*' && !index) {
			response.setHeader('Access-Control-Allow-Origin', origin);
		} else {
			response.setHeader('Access-Control-Allow-Origin', hostname);
		}
	}

	// Check for preflighted request
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

	// Prepare the response stream with possible compression
	if (contentEncoding) {
		response.setHeader('Content-Encoding', contentEncoding);
		response.stream = zlib['create' + contentEncoding]();
		response.stream.pipe(response);
	} else {
		response.stream = response;
	}

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	var routes = host.routes;

	// Create the route interface
	var routeInterface = [
		new requestInterface(request, response, host),
		new responseInterface(request, response, host)
	];

	// Verify referer
	if (headers.referer && host.referers.length) {
		var referer = url.parse(headers.referer).hostname;
		index = ~host.referers.indexOf(referer);
		var isBanned = host.referers[0] === '*' && index || !index;
		if (hostname !== referer && isBanned) {
			response.statusCode = 404;
			routes.error[404].apply(null, routeInterface);
			return;
		}
	}

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
		if (routes.post[requestURL]) {
			routes.post[requestURL].apply(null, routeInterface);
		} else if (routes.all[requestURL]) {
			routes.all[requestURL].apply(null, routeInterface);
		} else {
			response.statusCode = 404;
			routes.error[404].apply(null, routeInterface);
		}
	}

	// Route static files or their symbolic links
	function routeFiles(lastModified) {
		var extension = path.extname(requestURL).substr(1);
		var notModified = Number(headers['if-modified-since']) === lastModified;
		var code = 200;
		if (notModified) {
			code = 304;
		}
		response.writeHead(code, {
			'Content-Type': mimeTypes[extension] || mimeTypes['default'],
			'Last-Modified': lastModified
		});
		if (notModified) {
			response.end();
		} else {
			that.cacher(requestURL, response.stream);
		}
	}

	// Check path stats and route further
	function statCallback(error, stats) {
		if (!error && (stats.isFile() || stats.isSymbolicLink())) {
			routeFiles(stats.mtime.valueOf());
		} else if (!error && routes.serve.callback && stats.isDirectory()) {
			routes.serve.callback.apply(null, routeInterface);
		} else {
			response.statusCode = 404;
			routes.error[404].apply(null, routeInterface);
		}
	}

	// Route static files and directories
	function staticRouting() {

		// Check for client api file request
		if (requestURL === '/simples/client.js') {
			requestURL = __dirname + '/../utils/client.js';
		} else {
			requestURL = path.join(routes.serve.path, requestURL);
		}

		// Verify the stats of the path
		fs.stat(requestURL, statCallback);
	}

	// All requests routing
	function routing() {
		if (request.method === 'GET' || request.method === 'HEAD') {
			getRouting();
		} else if (request.method === 'POST') {
			postRouting();
		} else {
			response.statusCode = 405;
			response.setHeader('Allow', 'GET,POST');
			routes.error[405].apply(null, routeInterface);
		}
	}

	// Vulnerable code handling
	try {
		request.on('end', routing);
	} catch (error) {
		console.log('simpleS: Internal Server Error > "' + request.url + '"');
		console.log(error.stack + '\n');
		response.statusCode = 500;
		try {
			routes.error[500].apply(null, routeInterface);
		} catch (error) {
			console.log('simpleS: can not apply route for error 500');
			console.log(error.stack + '\n');
			response.stream.destroy();
		}
	}
};