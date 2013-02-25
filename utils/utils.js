var fs = require('fs');
var path = require('path');
var url = require('url');
var zlib = require('zlib');

var mime = require('./mime');
var requestInterface = require('../lib/request');
var responseInterface = require('../lib/response');

// Get sessions from file and activate them in the hosts
exports.getSessions = function (server, callback) {
	'use strict';

	// Activate the sessions from the file
	function activateSessions(sessions) {
		for (var i in server.hosts) {
			server.hosts[i].setSessions(sessions[i]);
		}
	}

	// Read and parse the sessions file
	fs.readFile('.sessions', 'utf8', function (error, data) {

		// Catch error at reading
		if (error) {
			console.log('simpleS: can not read sessions file');
			console.log(error.message + '\n');
			callback();
			return;
		}

		// Supervise session file parsing
		try {
			activateSessions(JSON.parse(data));
		} catch (error) {
			console.log('simpleS: can not parse sessions file');
			console.log(error.message + '\n');
		}

		// Continue to port listening
		callback();
	});
};

// Handle for static files content cache
exports.handleCache = function (server, path, stream) {
	'use strict';
	
	var index = 0;

	// Read 64kB pieces from cache
	function read() {
		if (server.cache[path].length - index > 65536) {
			stream.write(server.cache[path].slice(index, index += 65536));
			process.nextTick(read);
		} else {
			stream.end(server.cache[path].slice(index));
		}
	}

	// Callback for file reading and caching
	function reader(error, content) {

		// If the file can not be read
		if (error) {
			console.log('simpleS: can not cache "' + path + '"');
			delete server.cache[path];
			return;
		}

		server.cache[path] = content;
	}

	// Listener for watch files
	function watcher(event, filename) {
		if (event === 'change') {
			fs.readFile(path, reader);
		} else if (event === 'rename') {
			this.close();
			delete server.cache[path];
		}
	}

	if (server.cache[path]) {
		read();
	} else {

		server.cache[path] = Buffer(0);

		// Watch file changes for dynamic caching
		fs.watch(path, {
			persistent: false
		}, watcher);

		// Stream the data to the cache and the response
		fs.ReadStream(path).on('data', function (data) {
			server.cache[path] = Buffer.concat([server.cache[path], data]);
			stream.write(data);
		}).on('end', function () {
			stream.end();
		});
	}
};

// Handle for the HTTP(S) requests
exports.handleHTTPRequest = function (request, response) {
	'use strict';

	// Set the keep alive timeout of the socket to 5 seconds
	request.connection.setTimeout(5000);

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

	// Route GET requests
	function getRouting() {
		if (routes.get[requestURL]) {
			routes.get[requestURL].apply(null, routeInterface);
		} else if (routes.all[requestURL]) {
			routes.all[requestURL].apply(null, routeInterface);
		} else if (routes.serve.path || requestURL === '/simples/client.js') {
			staticRouting(routeInterface);
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
			'Content-Type': mime[extension] || mime['default'],
			'Last-Modified': lastModified
		});
		if (notModified) {
			response.end();
		} else {
			exports.handleCache(that, requestURL, response.stream);
		}
	}

	// Callback for stats of static path
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

		var referer = hostname;
		var isBanned = false;

		// Verify referer
		if (headers.referer && host.referers.length) {
			var referer = url.parse(headers.referer).hostname;
			index = ~host.referers.indexOf(referer);
			var isBanned = host.referers[0] === '*' && index || !index;
		}

		// Response with 404 code to banned referers
		if (hostname !== referer && isBanned) {
			response.statusCode = 404;
			routes.error[404].apply(null, routeInterface);
			return;
		}

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

		// Switch for HTTP methods
		if (request.method === 'GET' || request.method === 'HEAD') {
			getRouting(routeInterface);
		} else if (request.method === 'POST') {
			postRouting(routeInterface);
		} else {
			response.statusCode = 405;
			response.setHeader('Allow', 'GET,POST');
			routes.error[405].apply(null, routeInterface);
		}
	}

	// Handler for internal errors of the server
	function errorHandler() {
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

	// Start acting when the request ended
	request.on('end', function () {

		// Vulnerable code handling
		try {
			routing(routeInterface);
		} catch (error) {
			errorHandler(routeInterface);
		}
	});
};

// Get the sessions from the hosts and save them to file
exports.saveSessions = function (server, callback) {
	'use strict';

	// Sessions container
	var sessions = {};

	// Select and deactivate sessions
	for (var i in server.hosts) {
		sessions[i] = server.hosts[i].getSessions();
	}

	// Prepare sessions for writing on file
	sessions = JSON.stringify(sessions);

	// Write the sessions in the file
	fs.writeFile('.sessions', sessions, 'utf8', function (error) {
		
		// Release the server in all cases
		server.emit('release', callback);

		// Log the error
		if (error) {
			console.log('simpleS: can not write sessions to file');
			console.log(error.message + '\n');
			return;
		}

		// Lot the sessions file creation
		console.log('simpleS: file with sessions created');
	});
};