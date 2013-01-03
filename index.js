var fs = require('fs');

var host = require('./lib/host');
var server = require('./lib/server');

var simples = module.exports = function (port) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Call host in this context
	host.call(this);

	// Initialize the HTTP server
	Object.defineProperty(this, 'hosts', {
		value: {
			main: this
		}
	});

	Object.defineProperty(this, 'server', {
		value: new server(this.hosts)
	});

	this.server.on('error', function (error) {
		console.log('simpleS: Server Error\n' + error.message + '\n');
		this.started  = false;
	});

	this.start(port);
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Specify the engine to render the responses
simples.prototype.engine = function (engine) {
	'use strict';
	this.server.render = engine.render ? engine.render : engine;
	return this;
};

// Create a new host
simples.prototype.host = function (name) {
	'use strict';
	this.hosts[name] = new host(name);
	return this.hosts[name];
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
			if (fs.existsSync('.sessions')) {
				var sessions = JSON.parse(fs.readFileSync('.sessions', 'utf8'));
				Object.keys(this.hosts).forEach(function (element) {
					if (sessions[element]) {
						this.hosts[element].sessions = sessions[element];
					}
				}.bind(this));
			}
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
		var sessions = {};
		Object.keys(this.hosts).forEach(function (element) {
			sessions[element] = this.hosts[element].sessions;
		}.bind(this));
		fs.writeFileSync('.sessions', JSON.stringify(sessions), 'utf8');
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