var url = require('url');

var server = require('./lib/server');

module.exports = simples = function (port) {
	'use strict';

	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Initialize the HTTP server
	Object.defineProperty(this, 'server', {
		value: new server()
	});

	Object.defineProperty(this, 'routes', {
		value: this.server.routes
	});

	this.server.on('error', function (error) {
		console.log('simpleS: Server Error\n' + error.message + '\n');
		this.started  = false;
	});
	
	this.start(port);
}

// Accept requests from other origins
simples.prototype.accept = function (origins) {
	'use strict';
	this.server.origins = origins;
	return this;
};

// Route both GET and POST requests
simples.prototype.all = function (path, callback) {
	'use strict';
	this.routes.all[url.parse(path).pathname] = callback;
	return this;
};

// Route errors
simples.prototype.error = function (code, callback) {
	'use strict';

	// Accept only 404, 405 and 500 error codes
	if (this.routes.error.hasOwnProperty(code)) {
		this.routes.error[code] = callback;
	}

	return this;
};

// Route get requests
simples.prototype.get = function (path, callback) {
	'use strict';
	this.routes.get[url.parse(path).pathname] = callback;
	return this;
};

// Route post requests
simples.prototype.post = function (path, callback) {
	'use strict';
	this.routes.post[url.parse(path).pathname] = callback;
	return this;
};

// Route static files from a specific local path
simples.prototype.serve = function (path) {
	'use strict';
	this.routes.serve = path;
	return this;
};

// Start simples server
simples.prototype.start = function (port, callback) {
	'use strict';

	// If the server is already started, restart it with the provided port
	try {
		if (this.started) {
			this.server.close(function () {
				this.server.listen(port, function () {
					if (callback) {
						callback.call(this);
					}
				}.bind(this));
			}.bind(this));
		} else {
			this.started = true;
			this.server.listen(port, function () {
				if (callback) {
					callback.call(this);
				}
			}.bind(this));
		}
	} catch (error) {
		console.log('simpleS: Can not start server\n' + error.message + '\n');
	}

	return this;
};

// Stop simples server
simples.prototype.stop = function (callback) {
	'use strict';

	// Stop the server only if it is running
	try {
		if (this.started) {
			this.started = false;
			this.server.close(function () {
				if (callback) {
					callback.call(this);
				}
			}.bind(this));
		}
	} catch (error) {
		console.log('simpleS: Can not stop server\n' + error.message + '\n');
	}

	return this;
};

// New WebSocket host
simples.prototype.ws = function (url, config, callback) {
	'use strict';

	// Configuration for the WebSocket host
	this.server.wsHosts[url] = {
		config: {
			length: config.length || 1048575,
			protocols: config.protocols || ['']
		},
		connections: [],
		callback: callback
	};

	return this;
};