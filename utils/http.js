'use strict';

var cache = require('simples/utils/cache'),
	domain = require('domain'),
	http = require('http'),
	https = require('https'),
	stream = require('stream'),
	url = require('url'),
	utils = require('simples/utils/utils');

// Default callback for "Not Found"
function e404(connection) {
	connection.end('"' + connection.url.path + '" Not Found');
}

// Default callback for "Method Not Allowed"
function e405(connection) {
	connection.end('"' + connection.method + '" Method Not Allowed');
}

// Default callback for "Internal Server Error"
function e500(connection) {
	connection.end('"' + connection.url.path + '" Internal Server Error');
}

// Check if the referer header is accepted by the host
function refers(host, connection) {

	var headers = connection.request.headers,
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
}

// Returns the advanced route if found
function getDynamicRoute(connection, routes, verb) {

	var index = 0,
		lcurrent = '',
		lindex = 0,
		location = connection.path.substr(1),
		param = '',
		params = {},
		rcurrent = '',
		result = null,
		rindex = 0,
		route = '',
		keys = null,
		value = '';

	// Get the key of the parameter till next slash
	function getParameterName() {
		while (rcurrent && rcurrent !== '/') {
			param += rcurrent;
			rindex++;
			rcurrent = route[rindex];
		}
	}

	// Get the value of the parameter till next slash
	function getParameterValue() {
		while (lcurrent && lcurrent !== '/') {
			value += lcurrent;
			lindex++;
			lcurrent = location[lindex];
		}
	}

	// Get the parameter and its value from the URL
	function getParameter() {
		if (rcurrent === ':') {
			rindex++;
			rcurrent = route[rindex];
			getParameterName();
			getParameterValue();
			params[param] = decodeURIComponent(value);
			param = '';
			value = '';
		}
	}

	// Skip equal characters
	function skipEqual() {
		while (rcurrent && rcurrent === lcurrent) {
			lindex++;
			lcurrent = location[lindex];
			rindex++;
			rcurrent = route[rindex];
		}
	}

	// Compare advanced route with location
	function compareRoute(container) {

		// Get the current route
		route = keys[index];

		// Reset indexes and values
		lcurrent = location[0];
		lindex = 0;
		param = '';
		params = {};
		rcurrent = route[0];
		rindex = 0;
		value = '';

		// Compare pattern with location
		while (rcurrent && rcurrent === lcurrent) {
			skipEqual();
			getParameter();
		}

		// Check if result is ready
		if (!rcurrent) {
			connection.params = params;
			result = container[route];
		}

		// Get next route index
		index--;
	}

	// Start searching for the advanced route
	function findRoute(container) {

		// Prepare the routes
		keys = Object.keys(container);

		// Set the initial route index
		index = keys.length - 1;

		// While no result and there are routes, compare them with the location
		while (!result && keys[index]) {
			compareRoute(container);
		}
	}

	// Find the route in all routes
	findRoute(routes[verb]);

	// Find the route in the route specific verb
	if (!result) {
		findRoute(routes.all);
	}

	return result;
}

// Routes all the requests
function routing(host, connection) {

	var directory = [],
		file,
		location = connection.path.substr(1),
		methods = {
			'DELETE': 'del',
			'GET': 'get',
			'HEAD': 'get',
			'POST': 'post',
			'PUT': 'put'
		},
		middlewares = host.middlewares.slice(0),
		origin,
		request = connection.request,
		response = connection.response,
		route,
		routes = host.routes,
		verb = methods[request.method];

	// Route HTTP Server Error
	function routeServerError() {
		routes.error[500].call(host, connection);
	}

	// Callback for a static file route
	function staticRoute(connection) {

		var mtime = file.stats.mtime.valueOf();

		// Set the last modified time and the content type of the response
		connection.header('Last-Modified', mtime);
		connection.type(location.substr(location.lastIndexOf('.') + 1));

		// Check if modification time coincides on the client and on the server
		if (Number(connection.request.headers['if-modified-since']) === mtime) {
			connection.response.statusCode = 304;
			connection.end();
		} else {
			connection.end(file.content);
		}
	}

	// Apply the selected route
	function applyRoute() {
		if (file && file.stats.isDirectory()) {
			route.call(host, connection, directory);
		} else {
			route.call(host, connection);
		}
	}

	// Return file object for an array of files
	function getFilesArray(element) {

		return {
			name: element,
			stats: file.files[element].stats
		};
	}

	// Set the route for static files and directories
	function setStaticFilesRoute() {
		if (file && file.stats.isDirectory()) {
			directory = Object.keys(file.files).map(getFilesArray);
			route = host.routes.serve;
		} else if (file) {
			route = staticRoute;
		}
	}

	// Get middlewares one by one and execute them
	function shiftMiddlewares(stop) {
		if (middlewares.length && !stop) {
			middlewares.shift()(connection, shiftMiddlewares);
		} else if (!stop) {

			// Check if any logger is defined and log data
			if (host.logger.callback) {
				utils.log(host, connection);
			}

			// Use the routes
			if (typeof route === 'string') {
				connection.render(route);
			} else {
				applyRoute();
			}
		}
	}

	// Check for CORS requests
	if (request.headers.origin) {

		// Check if the origin is accepted
		if (utils.accepts(host, request)) {
			origin = request.headers.origin;
		} else {
			origin = connection.protocol + '://' + connection.host;
		}

		// Set CORS response headers
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'True');
		response.setHeader('Access-Control-Allow-Methods', 'True');
		response.setHeader('Access-Control-Allow-Origin', origin);

		// End the response
		if (request.method === 'OPTIONS') {
			response.end();
			return;
		}
	}

	// Find the route
	if (verb) {

		// Find the fixed route
		route = routes.fixed[verb][location] || routes.fixed.all[location];

		// Find the advanced route
		if (!route) {
			route = getDynamicRoute(connection, routes.dynamic, verb);
		}

		// Check for routes to static files and directories
		if (!route && verb === 'get' && refers(host, connection)) {
			file = host.cache.read(location);
			setStaticFilesRoute();
		}

		// Set error 404 if no route found
		if (!route) {
			response.statusCode = 404;
			route = routes.error[404];
		}
	} else {
		response.statusCode = 405;
		response.setHeader('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	}

	// Wrap the connection inside a domain
	domain.create().on('error', function (error) {
		if (response.statusCode === 500) {
			console.error('\nsimpleS: Can not apply route for error 500');
			console.error(error.stack + '\n');
		} else {
			console.error('\nsimpleS: Internal Server Error');
			console.error(connection.url.href);
			console.error(error.stack + '\n');
			response.statusCode = 500;
			this.run(routeServerError);
		}
	}).run(shiftMiddlewares);
}

// Generate empty routes
exports.defaultRoutes = function () {

	return {
		dynamic: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		error: {
			404: e404,
			405: e405,
			500: e500
		},
		fixed: {
			all: {},
			del: {},
			get: {},
			post: {},
			put: {}
		},
		serve: null
	};
};

exports.requestListener = function (host, connection) {

	var length = 0,
		parser,
		parts = [],
		request = connection.request;

	// Listener for request end event
	function onEnd() {

		// If parser is defined end parsing
		if (parser) {
			parser.parse(null);
			connection.body = parser.result;
		}

		routing(host, connection);
	}

	// Listener for request readable event
	function onReadable() {

		var data = request.read() || new Buffer(0);

		// Get the read length
		length += data.length;

		// Check for request body limit and parse data
		if (length > host.conf.requestLimit) {
			console.error('\nsimpleS: Request Entity Too Large\n');
			request.destroy();
		} else if (parser) {
			parser.parse(data.toString());
		} else {
			connection.body = utils.buffer(connection.body, data, length);
		}
	}

	// Set the keep alive timeout of the request socket to 5 seconds
	request.connection.setTimeout(5000);

	// Set the default content type to HTML and charset UTF-8
	connection.response.setHeader('Content-Type', 'text/html;charset=utf-8');

	// Route the request and parse it if needed
	if (request.method === 'GET' || request.method === 'HEAD') {
		routing(host, connection);
	} else if (request.headers['content-length'] > host.conf.requestLimit) {
		console.error('\nsimpleS: Request Entity Too Large\n');
		request.destroy();
	} else {

		// Split content type in two parts to get boundary if exists
		if (request.headers['content-type']) {
			parts = request.headers['content-type'].split(';');
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
		request.on('readable', onReadable).on('end', onEnd);
	}
};