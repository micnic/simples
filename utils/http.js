'use strict';

var cache = require('simples/lib/cache'),
	domain = require('domain'),
	path = require('path'),
	store = require('simples/lib/store'),
	url = require('url'),
	utils = require('simples/utils/utils'),
	zlib = require('zlib');

// HTTP namespace
var http = exports;

// Link to the HTTP connection prototype constructor
http.connection = require('simples/lib/http/connection');

// Relations between HTTP methods and REST verbs
http.verbs = {
	'DELETE': 'del',
	'GET': 'get',
	'HEAD': 'get',
	'POST': 'post',
	'PUT': 'put'
};

// Apply the selected route
http.applyRoute = function (connection, route) {

	var host = connection.parent;

	// Check if any logger is defined and log data
	if (host.logger.callback) {
		utils.log(host, connection);
	}

	// Apply the route
	if (typeof route === 'function') {
		route.call(host, connection);
	} else if (typeof route === 'string') {
		connection.render(route);
	} else {
		http.applyStaticRoute(connection, route);
	}
};

// Apply the routes for static files and directories
http.applyStaticRoute = function (connection, element) {

	var directory = null,
		extension = '',
		host = connection.parent,
		mtime = 0,
		routes = host.routes,
		stats = element.stats;

	// Check if the element is a directory or a file
	if (stats.isDirectory()) {

		// Prepare directory items
		directory = Object.keys(element.files).map(function (name) {

			var item = {};

			// Prepare item object
			item.name = name;
			item.stats = element.files[name].stats;

			return item;
		});

		// Apply the route for the directory
		routes.serve.call(host, connection, directory);
	} else {

		// Prepare element properties
		extension = path.extname(element.location).slice(1);
		mtime = stats.mtime.valueOf();

		// Set the last modified time and the content type of the response
		connection.header('Last-Modified', mtime).type(extension);

		// Check if modification time coincides on the client and on the server
		if (Number(connection.headers['if-modified-since']) === mtime) {
			connection.status(304).end();
		} else {
			connection.end(element.content);
		}
	}
};

// Set compression for HTTP connections
http.compress = function (connection) {

	var compression = connection.parent.conf.compression,
		deflate = false,
		encoding = connection.headers['accept-encoding'],
		gzip = false,
		type = connection.type(),
		wstream = connection.response;

	// Check for supported content encodings of the client
	if (encoding && compression.enabled && compression.filter.test(type)) {

		// Lower case for comparing
		encoding = encoding.toLowerCase();

		// Get accepted encodings
		deflate = encoding.indexOf('deflate') >= 0;
		gzip = encoding.indexOf('gzip') >= 0;

		// Check for supported compression
		if (deflate && (compression.preferred === 'deflate' || !gzip)) {
			encoding = 'deflate';
			wstream = zlib.Deflate(compression.options);
		} else if (gzip && (compression.preferred === 'gzip' || !deflate)) {
			encoding = 'gzip';
			wstream = zlib.Gzip(compression.options);
		}

		// Check for successful compression selection
		if (wstream !== connection.response) {
			connection.header('Content-Encoding', encoding);
			wstream.pipe(connection.response);
		}
	}

	// Pipe the connection to the compress stream or the response stream
	connection.pipe(wstream);
};

// Listener for HTTP requests
http.connectionListener = function (host, request, response) {

	var connection = new http.connection(host, request, response);

	// Route the connection and parse received data if needed
	if (connection.method === 'GET' || connection.method === 'HEAD') {
		http.connectionProcess(connection);
	} else if (connection.method === 'OPTIONS') {
		connection.end();
	} else if (connection.headers['content-length'] > host.conf.limit) {
		console.error('\nsimpleS: Request Entity Too Large\n');
		request.destroy();
	} else {
		http.connectionParser(connection);
	}
};

// Decide what to do with the request depending on its method
http.connectionProcess = function (connection) {

	var config = connection.parent.conf;

	// Check if sessions are enabled
	if (config.session.enabled) {
		utils.getSession(connection.parent, connection, http.setSession);
	} else {
		http.routing(connection);
	}
};

// Populate connection body and files
http.connectionParser = function (connection) {

	var host = connection.parent,
		length = 0,
		parser = null,
		parts = [];

	// Split content type in two parts to get boundary if exists
	if (connection.headers['content-type']) {
		parts = connection.headers['content-type'].split(';');
	}

	// Choose the content parser
	if (parts[0] === 'application/x-www-form-urlencoded') {
		parser = new utils.parsers.qs();
	} else if (parts[0] === 'multipart/form-data' && parts.length > 1) {
		parser = new utils.parsers.multipart(parts[1].substr(10));
	} else if (parts[0] === 'application/json') {
		parser = new utils.parsers.json();
	}

	// If no parser was defined then make connection body a buffer
	if (!parser) {
		connection.body = new Buffer(0);
	}

	// Process received data
	connection.request.on('readable', function () {

		var data = this.read() || new Buffer(0);

		// Get the read length
		length += data.length;

		// Check for request body limit and parse data
		if (length > host.conf.limit) {
			console.error('\nsimpleS: Request Entity Too Large\n');
			this.destroy();
		} else if (parser) {
			parser.parse(data.toString());
		} else {
			connection.body = utils.buffer(connection.body, data, length);
		}
	}).on('end', function () {

		// If parser is defined end parsing
		if (parser) {
			parser.parse(null);
			connection.body = parser.result.body;
			connection.files = parser.result.files;
		}

		http.connectionProcess(connection);
	});
};

// Generate default config for hosts
http.defaultConfig = function () {

	return {
		compression: {
			enabled: true,
			filter: /^.+$/i,
			options: null, // http://nodejs.org/api/zlib.html#zlib_options
			preferred: 'deflate' // can be 'deflate' or 'gzip'
		},
		limit: 1048576, // bytes, by default is 1 MB
		origins: [],
		referers: [],
		session: {
			enabled: false,
			store: new store(),
			timeout: 3600000 // miliseconds, by default 1 hour
		}
	};
};

// Generate empty routes
http.defaultRoutes = function () {

	return {
		dynamic: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		error: {
			404: http.e404,
			405: http.e405,
			500: http.e500
		},
		fixed: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		serve: null,
		ws: {}
	};
};

// Default callback for "Not Found"
http.e404 = function (connection) {
	connection.end('"' + connection.url.path + '" Not Found');
};

// Default callback for "Method Not Allowed"
http.e405 = function (connection) {
	connection.end('"' + connection.method + '" Method Not Allowed');
};

// Default callback for "Internal Server Error"
http.e500 = function (connection) {
	connection.end('"' + connection.url.path + '" Internal Server Error');
};

// Returns the advanced route if found
http.getDynamicRoute = function (connection, routes, verb) {

	var location = connection.path.substr(1),
		index = 0,
		keys = Object.keys(routes[verb]),
		length = keys.length,
		result = null,
		route = null;

	// Search for a valid route
	while (!result && index < length) {

		// Select the current route
		route = routes[verb][keys[index]];

		// Check if the location matches the route pattern
		if (route.pattern.test(location)) {
			result = route.callback;
		}

		// Switch to "all" verb if no result found
		if (index === length - 1 && verb !== 'all' && !result) {
			index = 0;
			keys = Object.keys(routes.all);
			length = keys.length;
			verb = 'all';
		} else {
			index++;
		}
	}

	// Populate connection parameters if the route is found
	if (result) {
		location.match(route.pattern).slice(1).forEach(function (param, key) {
			connection.params[route.keys[key]] = param;
		});
	}

	return result;
};

// Check if the referer header is accepted by the host
http.refers = function (host, connection) {

	var headers = connection.headers,
		hostname = url.parse(headers.referer || '').hostname || '',
		referers = host.conf.referers,
		valid = true;

	// Check for referer
	if (headers.referer && hostname !== connection.host) {
		valid = false;
	}

	// Check if referer is found in the accepted referers list
	if (!valid && hostname && referers.length) {
		if (referers.indexOf(hostname) < 0) {
			valid = referers[0] === '*';
		} else {
			valid = referers[0] !== '*';
		}
	}

	return valid;
};

// Routes all the requests
http.routing = function (connection) {

	var host = connection.parent,
		index = 0,
		length = host.middlewares.length,
		location = connection.path.substr(1),
		route = null,
		routes = host.routes,
		verb = http.verbs[connection.method];

	// Get middlewares one by one and execute them
	function nextMiddleware(stop) {
		if (index < length && !stop) {
			setImmediate(host.middlewares[index], connection, nextMiddleware);
			index++;
		} else if (!stop) {
			http.applyRoute(connection, route);
		}
	}

	// Find the fixed and dynamic route
	if (verb) {
		if (routes.fixed[verb][location]) {
			route = routes.fixed[verb][location];
		} else if (routes.fixed.all[location]) {
			route = routes.fixed.all[location];
		} else {
			route = http.getDynamicRoute(connection, routes.dynamic, verb);
		}
	}

	// Get static content if found
	if (!route && verb === 'get' && http.refers(host, connection)) {

		// Check for client side API file serve
		if (location === 'simples.js') {
			route = cache.client;
		} else {
			route = host.cache.read(location);
		}
	}

	// Check for errors 404 and 405
	if (!verb) {
		connection.status(405).header('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	} else if (!route) {
		connection.status(404);
		route = routes.error[404];
	}

	// Wrap the connection inside a domain
	domain.create().on('error', function (error) {
		if (connection.status() === 500) {
			console.error('\nsimpleS: Can not apply route for error 500');
			console.error(error.stack + '\n');
		} else {
			console.error('\nsimpleS: Internal Server Error');
			console.error(connection.url.href);
			console.error(error.stack + '\n');
			connection.status(500);
			this.bind(routes.error[500]).call(host, connection);
		}
	}).run(nextMiddleware);
};

// Set needed headers that are missing
http.prepareConnection = function (connection) {

	var cors = null,
		host = connection.parent;

	// Check for CORS requests
	if (connection.headers.origin) {

		// Prepare the cors headers container
		cors = {};

		// Check if the origin is accepted
		if (utils.accepts(host, connection)) {
			cors.origin = connection.headers.origin;
		} else {
			cors.origin = connection.protocol + '://' + connection.host;
		}

		// Prepare CORS specific response headers
		cors.headers = connection.headers['access-control-request-headers'];
		cors.methods = connection.headers['access-control-request-method'];

		// Always allow credentials
		connection.header('Access-Control-Allow-Credentials', 'True');

		// Response with the requested headers
		if (cors.headers) {
			connection.header('Access-Control-Allow-Headers', cors.headers);
		}

		// Response with the requested methods
		if (cors.methods) {
			connection.header('Access-Control-Allow-Methods', cors.methods);
		}

		// Set the accepted origin
		connection.header('Access-Control-Allow-Origin', cors.origin);
	}

	// Check if the content type was defined and set the default if it is not
	if (!connection.type()) {
		connection.type('html');
	}

	// Set the keep alive timeout
	connection.keep(5000);

	// Set the started flag
	connection.started = true;
};

// Set the session cookies for HTTP requests
http.setSession = function (connection, session) {

	var config = connection.parent.conf,
		options = {},
		store = config.session.store;

	// Prepare cookies options
	options.expires = config.session.timeout;
	options.httpOnly = true;

	// Write the session cookies
	connection.cookie('_session', session.id, options);
	connection.cookie('_hash', session.hash, options);

	// Link the session container to the connection
	connection.session = session.container;

	// Write the session to the store and remove its reference
	connection.on('finish', function () {
		store.set(session.id, {
			id: session.id,
			hash: session.hash,
			expire: config.session.timeout * 1000 + Date.now(),
			container: connection.session
		}, function () {
			connection.session = null;
		});
	});

	// Continue to process the request
	http.routing(connection);
};