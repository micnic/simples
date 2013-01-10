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

	// Set simpleS properties
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		hosts: {
			value: {
				main: this
			}
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Initialize the HTTP server
	Object.defineProperty(this, 'server', {
		value: new server(this.hosts)
	});

	// Set keep alive timeout to 5 seconds
	this.server.on('connection', function (socket) {
		socket.setTimeout(5000);
	});

	// Catch runtime errors
	this.server.on('error', function (error) {
		console.log('simpleS: Server Error\n' + error.message + '\n');
		this.started  = false;
		this.busy = false;
	}.bind(this));

	// Inform when the server is not busy
	this.server.on('release', function () {
		this.busy = false;
	}.bind(this));

	// Start the server on the provided port
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

// Specify the template engine to render the responses
simples.prototype.engine = function (engine) {
	'use strict';

	// If the template engine has render method use it
	this.server.render = engine.render ? engine.render : engine;
	return this;
};

// Create a new host
simples.prototype.host = function (name) {
	'use strict';

	// Create the new host and save it to the hosts object
	this.hosts[name] = new host(name);
	return this.hosts[name];
};

// Start simples server
simples.prototype.start = function (port, callback) {
	'use strict';

	// Set the server to listen the port
	function listen() {
		this.server.listen(port, function () {
			this.server.emit('release');
			if (callback) {
				callback.call(this);
			}
		}.bind(this));
	}

	// Close the server and start listening on the new port
	function restart() {
		this.busy = true;
		this.server.close(listen.bind(this));
	};

	// Start listening on the provided port
	function start() {
		this.busy = true;
		this.started = true;
		listen.call(this);
	};

	try {

		// If the server is already started, restart it
		if (this.started) {
			if (this.busy) {
				this.server.once('release', function () {
					restart.call(this);
				}.bind(this));
			} else {
				restart.call(this);
			}
		} else {
			// TODO here: get sessions from file
			/*if (fs.existsSync('.sessions')) {
				var sessions = JSON.parse(fs.readFileSync('.sessions', 'utf8'));
				Object.keys(this.hosts).forEach(function (element) {
					if (sessions[element]) {
						this.hosts[element].sessions = sessions[element];
					}
				}.bind(this));
			}*/

			this.server.port = port;
			if (this.busy) {
				this.server.once('release', function () {
					start.call(this);
				}.bind(this));
			} else {
				start.call(this);
			}
		}
	} catch (error) {
		console.log('simpleS: Can not start server\n' + error.message + '\n');
	}

	return this;
};

// Stop simpleS server
simples.prototype.stop = function (callback) {
	'use strict';

	// Close the server
	function stop() {
		this.started = false;
		this.busy = true;
		this.server.close(function () {
			this.server.emit('release');
			if (callback) {
				callback.call(this);
			}
		}.bind(this));
	}

	try {
		// TODO here: save sessions to file
		/*var sessions = {};
		Object.keys(this.hosts).forEach(function (element) {
			sessions[element] = this.hosts[element].sessions;
		}.bind(this));
		fs.writeFileSync('.sessions', JSON.stringify(sessions), 'utf8');*/

		// Remove active sessions sessions
		for (var i in this.hosts) {
			for (var j in this.hosts[i].sessions) {
				clearTimeout(this.hosts[i].sessions[j]._timeout);
			}
		}

		// Stop the server only if it is running
		if (this.started && this.busy) {
			this.server.once('release', function () {
				stop.call(this);
			}.bind(this));
		} else if (this.started) {
			stop.call(this);
		}
	} catch (error) {
		console.log('simpleS: Can not stop server\n' + error.message + '\n');
	}

	return this;
};