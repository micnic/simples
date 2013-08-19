'use strict';

var cache = require('../utils/cache'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	httpConnection = require('./http/connection'),
	qs = require('querystring'),
	stream = require('stream'),
	utils = require('../utils/utils'),
	url = require('url'),
	wsUtils = require('./ws');

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

	var accepted = true,
		referer,
		request = connection.request;

	if (request.headers.referer && host.conf.referers.length) {
		referer = url.parse(request.headers.referer).hostname;

		if (host.conf.referers.indexOf(referer) < 0) {
			accepted = host.conf.referers[0] === '*';
		} else {
			accepted = host.conf.referers[0] !== '*';
		}
	}

	return accepted || referer === connection.host;
}

// Returns the advanced route if found
function findAdvancedRoute(routes, location) {

	var param,
		params = {},
		route,
		value;

	['all', 'del', 'get', 'post', 'put'].some(function (verb) {
		return Object.keys(routes[verb].advanced).some(function (element) {
			var locationIndex = 0,
				routeIndex = 0;

			while (element.charAt(routeIndex)) {
				if (element.charAt(routeIndex) === location.charAt(locationIndex)) {
					routeIndex++;
					locationIndex++;
				} else if (element.charAt(routeIndex) === ':') {
					param = '';
					value = '';
					routeIndex++;

					while (element.charAt(routeIndex) && element.charAt(routeIndex) !== '/') {
						param += element.charAt(routeIndex);
						routeIndex++;
					}

					while (location.charAt(locationIndex) && location.charAt(locationIndex) !== '/') {
						value += location.charAt(locationIndex);
						locationIndex++;
					}

					params[param] = value;

					if (routeIndex === element.length) {
						route = routes[verb].advanced[element];
					}
				} else {
					params = {};
					route = null;
					break;
				}
			}

			return route;
		});
	});

	return {
		params: params,
		route: route
	};
}

// Parse data sent via POST method
function parsePOST(connection) {

	var boundary,
		boundaryLength,
		buffer = '',
		content = connection.request.headers['content-type'],
		contentType,
		currentChar = content.charAt(0),
		filecontent,
		filename,
		index = 0,
		name,
		POSTquery,
		tempIndex,
		type;

	while (currentChar === ' ') {
		index++;
		currentChar = content.charAt(index);
	}
	if (!currentChar) {
		return;
	}
	contentType = '';
	while (currentChar && currentChar !== ' ' && currentChar !== ';') {
		contentType += currentChar;
		index++;
		currentChar = content.charAt(index);
	}
	if (contentType === 'multipart/form-data') {
		while (currentChar === ' ' || currentChar === ';') {
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar) {
			return;
		}
		while (currentChar && currentChar !== ' ' && currentChar !== '=') {
			buffer += currentChar;
			index++;
			currentChar = content.charAt(index);
		}
		if (buffer !== 'boundary' || !currentChar) {
			return;
		}
		while (currentChar === ' ' || currentChar === '=') {
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar) {
			return;
		}
		boundary = '';
		while (currentChar) {
			boundary += currentChar;
			index++;
			currentChar = content.charAt(index);
		}
		if (!boundary) {
			return;
		}
		content = connection.body;
		index = 0;
		currentChar = content.charAt(index);
		boundaryLength = boundary.length;
		while (content.substr(index, 4 + boundaryLength) === '--' + boundary + '\r\n') {
			index += 4 + boundaryLength;
			index = content.indexOf('name="', index) + 6;
			if (index < 6) {
				break;
			}
			name = content.substring(index, content.indexOf('"', index));
			index += name.length + 1;
			tempIndex = content.indexOf('filename="', index) + 10;
			filename = undefined;
			if (tempIndex >= 10) {
				filename = content.substring(tempIndex, content.indexOf('"', tempIndex));
				index += 11 + filename.length;
				index = content.indexOf('Content-Type: ', index) + 14;
				type = content.substring(index, content.indexOf('\r', index));
				index += type.length;
			}
			index += 4;
			filecontent = '';
			while (content.substr(index, 4 + boundaryLength) !== '\r\n--' + boundary) {
				filecontent += currentChar;
				index++;
				currentChar = content.charAt(index);
			}
			if (filename) {
				connection.files[name] = {
					content: filecontent,
					filename: filename,
					type: type
				};
			} else {
				connection.query[name] = filecontent;
			}
			index += 2;
		}
	} else {
		POSTquery = qs.parse(connection.body);
		Object.keys(POSTquery).forEach(function (element) {
			connection.query[element] = POSTquery[element];
		});
	}
}

// Routes all the requests
function routing(host, connection) {

	var del,
		file,
		files,
		found,
		get,
		post,
		put,
		origin,
		request = connection.request,
		requestURL = connection.path.substr(1),
		response = connection.response,
		route,
		routes = host.routes;

	// Callback for a static file route
	function staticRoute(connection) {

		var index,
			mtime = file.stats.mtime.valueOf(),
			rstream;

		// Set the last modified time and the content type of the response
		connection.header('Last-Modified', mtime);
		connection.type(requestURL.substr(requestURL.lastIndexOf('.') + 1));

		// Check if modification time coincides on the client and on the server
		if (Number(connection.request.headers['if-modified-since']) === mtime) {
			connection.response.statusCode = 304;
			connection.end();
		} else {
			index = 0;
			rstream = new stream.Readable();
			rstream._read = function () {
				if (file.content.length > index + 16384) {
					this.push(file.content.slice(index, 16384));
					index += 16384;
				} else {
					this.push(file.content.slice(index));
					this.push(null);
				}
			};
			rstream.pipe(connection);
		}
	}

	del = request.method === 'DELETE';
	get = request.method === 'GET' || request.method === 'HEAD';
	post = request.method === 'POST';
	put = request.method === 'PUT';

	// Check for CORS requests
	if (request.headers.origin) {

		// Check if the origin is accepted
		if (exports.accepts(host, request)) {
			origin = request.headers.origin;
		} else {
			origin = connection.protocol + '://' + connection.host;
		}

		// Set CORS response headers
		response.setHeader('Access-Control-Allow-Credentials', 'True');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		response.setHeader('Access-Control-Allow-Methods', 'DELETE,GET,HEAD,POST,PUT');
		response.setHeader('Access-Control-Allow-Origin', origin);

		// End the response
		if (request.method === 'OPTIONS') {
			response.end();
			return;
		}
	}

	// Find the route
	if ((del || get || post || put) && routes.all.simple[requestURL]) {
		route = routes.all.simple[requestURL];
	} else if (del && routes.del.simple[requestURL]) {
		route = routes.del.simple[requestURL];
	} else if (get && routes.get.simple[requestURL]) {
		route = routes.get.simple[requestURL];
	} else if (post && routes.post.simple[requestURL]) {
		route = routes.post.simple[requestURL];
	} else if (put && routes.put.simple[requestURL]) {
		route = routes.out.simple[requestURL];
	} else if (del || get || post || put) {

		// Find the advanced route
		found = findAdvancedRoute(routes, requestURL);

		// Populate the connection parameters and use the selected route
		if (found.route) {
			connection.params = found.params;
			route = found.route;
		}

		// Check for static files routes
		if (!route && get && refers(host, connection)) {

			// Get cached files
			if (!host.cache && requestURL === 'simples.js') {
				file = cache.client;
			} else if (host.cache) {
				file = host.cache.read(requestURL);
			}

			// Return the route
			if (file && file.stats.isDirectory()) {
				route = host.routes.serve;
			} else if (file) {
				route = staticRoute;
			} else {
				route = null;
			}
		} else if (!route) {
			response.statusCode = 404;
			route = routes.error[404];
		}
	} else {
		response.statusCode = 405;
		response.setHeader('Allow', 'DELETE,GET,HEAD,POST,PUT');
		route = routes.error[405];
	}

	// Listen for internal errors
	connection.on('error', function (error) {
		console.error('\nsimpleS: Internal Server Error > ' + this.url.href);
		console.error(error.stack + '\n');
		response.statusCode = 500;

		// Try to apply the route for error 500
		try {
			routes.error[500].call(host, this);
		} catch (stop) {
			console.error('\nsimpleS: Can not apply route for error 500');
			console.error(stop.stack + '\n');
		}
	});

	// Vulnerable code handling
	try {
		if (typeof route === 'string') {
			connection.render(route);
		} else {
			if (file && file.stats.isDirectory()) {
				files = [];
				Object.keys(file.files).forEach(function (element) {
					files.push({
						name: element,
						stats: file.files[element].stats
					});
				});
				route.call(host, connection, files);
			} else {
				route.call(host, connection);
			}
		}
	} catch (error) {
		connection.emit(error);
	}
}

// Populate the body of the requet and route requests
function httpPopulateBody(host, connection) {

	var body = new Buffer(0),
		request = connection.request;

	// Check for too big request body
	function limitLength(length, callback) {
		if ((length | 0) > host.conf.limit) {
			console.error('\nsimpleS: Request Entity Too Large\n');
			request.destroy();
		} else if (callback) {
			callback();
		}
	}

	limitLength(request.headers['content-length'], function () {

		// Listen for incoming data
		request.on('readable', function () {

			// Concatenate body chunks
			body = Buffer.concat([body, this.read() || new Buffer(0)]);

			// Check for request body limit
			limitLength(body.length);
		}).on('end', function () {

			// Convert buffer data to UTF-8 encoded string
			connection.body = body.toString();

			// Populate the files and the query of POST requests
			if (this.method === 'POST' && this.headers['content-type']) {
				parsePOST(connection);
			}

			// Route the requests
			routing(host, connection);
		});
	});
}

// HTTP request listener
function httpRequestListener(request, response) {

	var connection,
		host = this.parent.hosts[request.headers.host.split(':')[0]];

	// Get the main host if the other one does not exist or is inactive
	if (!host || !host.active) {
		host = this.parent.hosts.main;
	}

	// Create the HTTP connection
	connection = new httpConnection(host, request, response);

	// Set the keep alive timeout of the request socket to 5 seconds
	request.connection.setTimeout(5000);

	// Set the default content type to HTML and charset UTF-8
	response.setHeader('Content-Type', 'text/html;charset=utf-8');

	// Route the request and parse them if needed
	if (request.method === 'GET' || request.method === 'HEAD') {
		routing(host, connection);
	} else {
		httpPopulateBody(host, connection);
	}
}

function httpsCreateServer(options, callback) {

	var aux,
		files,
		server;

	function httpsServer(options) {

		// Prepare the HTTP and the HTTPS servers
		aux = http.Server(httpRequestListener);
		server = https.Server(options, httpRequestListener);

		// Catch the errors in the auxiliary HTTP server
		aux.on('error', function (error) {
			server.emit('error', error);
		}).on('upgrade', wsUtils.wsRequestListener);;

		// Manage the HTTP server depending on HTTPS events
		server.on('open', function () {
			aux.listen(80);
		}).on('close', function () {
			aux.close();
		}).on('upgrade', wsUtils.wsRequestListener);;

		// Send the server object through the callback
		callback(server);
	}

	function httpsFileReady() {
		files--;

		if (!files) {
			httpsServer(options);
		}
	}

	// Check the options and read the files
	if (options.cert && options.key) {

		// Set the number of files to read
		files = 2;

		// Read the certificate of the server
		fs.ReadStream(options.cert).on('error', function () {
			throw new Error('simpleS: Can not read "' + options.cert + '"');
		}).on('readable', function () {
			options.cert = Buffer.concat([options.cert, this.read()]);
		}).on('end', httpsFileReady);

		// Read the private key of the server
		fs.ReadStream(options.key).on('error', function () {
			throw new Error('simpleS: Can not read "' + options.key + '"');
		}).on('readable', function () {
			options.key = Buffer.concat([options.key, this.read()]);
		}).on('end', httpsFileReady);

		// Prepare the buffers
		options.cert = new Buffer(0);
		options.key = new Buffer(0);
	} else if (options.pfx) {
		fs.ReadStream(options.pfx).on('error', function () {
			throw new Error('simpleS: Can not read "' + options.pfx + '"');
		}).on('readable', function () {
			options.pfx = Buffer.concat([options.pfx, this.read()]);
		}).on('end', function () {
			httpsServer(options);
		});
	} else {
		throw new Error('simpleS: Invalid data for the HTTPS server');
	}
}

// Generate empty routes
exports.httpDefaultRoutes = function () {

	return {
		all: {
			advanced: [],
			simple: {}
		},
		del: {
			advanced: [],
			simple: {}
		},
		error: {
			404: e404,
			405: e405,
			500: e500
		},
		get: {
			advanced: [],
			simple: {}
		},
		post: {
			advanced: [],
			simple: {}
		},
		put: {
			advanced: [],
			simple: {}
		},
		serve: null
	};
};

// Create the HTTP or the HTTPS server
exports.httpCreateServer = function (options, callback) {

	var server;

	// Choose the type of the server depending on the options provided
	if (options) {
		httpsCreateServer(options, callback);
	} else {
		server = http.Server(httpRequestListener);
		server.on('upgrade', wsUtils.wsRequestListener);
		callback(server);
	}
};