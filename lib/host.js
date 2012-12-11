var url = require('url');

var host = module.exports = function () {
	'use strict';
	this.origins = [];
	this.routes = {
		all: {},
		error: {

			// Not Found
			404: function (request, response) {
				response.end('"' + request.url.path + '" Not Found');
			},

			// Method Not Allowed
			405: function (request, response) {
				response.end('"' + request.method + '" Method Not Allowed');
			},

			// Internal Server Error
			500: function (request, response) {
				response.end('"' + request.url.path + '" Internal Server Error');
			}
		},
		get: {},
		post: {},
		serve: undefined,
	};
	this.sessions = {};
	this.wsHosts = {};
};

// Accept requests from other origins
host.prototype.accept = function () {
	'use strict';
	this.origins = arguments;
	return this;
};

// Route both GET and POST requests
host.prototype.all = function (path, callback) {
	'use strict';
	this.routes.all[url.parse(path).pathname] = callback;
	return this;
};

// Route errors
host.prototype.error = function (code, callback) {
	'use strict';

	// Accept only 404, 405 and 500 error codes
	if (this.routes.error.hasOwnProperty(code)) {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
host.prototype.get = function (path, callback) {
	'use strict';
	this.routes.get[url.parse(path).pathname] = callback;
	return this;
};

// Route post requests
host.prototype.post = function (path, callback) {
	'use strict';
	this.routes.post[url.parse(path).pathname] = callback;
	return this;
};

// Route static files from a specific local path
host.prototype.serve = function (path) {
	'use strict';
	this.routes.serve = path;
	return this;
};

// New WebSocket host
host.prototype.ws = function (url, config, callback) {
	'use strict';

	// Configuration for the WebSocket host
	this.wsHosts[url] = {
		config: {
			length: config.length || 1048575,
			protocols: config.protocols || [''],
			raw: config.raw || false
		},
		connections: [],
		callback: callback
	};

	return this;
};