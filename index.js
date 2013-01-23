var fs = require('fs');
var path = require('path');

var host = require('./lib/host');
var server = require('./lib/server');

var dirname = path.dirname(module.parent.filename);

// Will get sessions from file
function getSessions(instance, callback) {
	'use strict';

	var hosts = instance.server.hosts;
	var session;
	var sessions;
	var timeout;

	function sessionKiller(x, y) {
		delete hosts[x].sessions[y];
	}

	function hostIterator(i) {
		if (!sessions[i]) {
			return;
		}
		hosts[i].sessions = sessions[i];
		for (var j in sessions[i]) {
			sessionIterator(i, j);
		}
	}

	function sessionIterator(i, j) {
		session = hosts[i].sessions;
		timeout = Math.abs(session[j]._timeout);

		// If no absolute value
		if (!timeout) {
			throw new Error('invalid timeout');
		}

		session[j]._timeout = setTimeout(sessionKiller, timeout, i, j);
	}

	// Activate the sessions from the file
	function activateSessions() {

		for (var i in hosts) {
			hostIterator(i);
		}
	}

	// Read and parse the sessions file
	fs.readFile(dirname + '/.sessions', 'utf8', function (error, data) {
		instance.server.emit('release', callback);

		// Catch error at reading
		if (error) {
			console.log('simpleS: can not read sessions file');
			console.log(error.message + '\n');
			return;
		}

		// Supervise session file parsing
		try {
			sessions = JSON.parse(data);
			activateSessions();
		} catch (error) {
			console.log('simpleS: can not parse sessions file');
			console.log(error.message + '\n');
		}
	});
}

// Will save sessions to file
function saveSessions(instance, callback) {
	'use strict';
	var hosts = instance.server.hosts;
	var sessions = {};

	// Select and deactivate sessions
	for (var i in hosts) {
		sessions[i] = hosts[i].sessions;
		for (var j in hosts[i].sessions) {
			var timer = hosts[i].sessions[j]._timeout;
			var timeout = timer._idleTimeout;
			var start = new Date(timer._idleStart).valueOf();
			var end = new Date(start + timeout).valueOf();
			clearTimeout(hosts[i].sessions[j]._timeout);
			hosts[i].sessions[j]._timeout = end - new Date().valueOf();
		}
	}

	sessions = JSON.stringify(sessions);

	fs.writeFile(dirname + '/.sessions', sessions, 'utf8', function (error) {
		instance.server.emit('release', callback);
		if (error) {
			console.log('simpleS: can not write sessions to file');
			console.log(error.message + '\n');
			return;
		}
		console.log('simpleS: file with sessions created');
	});
}

// SimpleS prototype constructor
var simples = module.exports = function (port) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Call host in this context
	host.call(this, 'main');

	// Shortcut to this context
	var that = this;

	function sigintListener() {
		console.log('\nManual stopping simpleS, this may take few seconds');
		that.stop();
	}

	// Set simpleS properties
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		sigintListener: {
			value: sigintListener
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Initialize the HTTP server
	Object.defineProperty(this, 'server', {
		value: new server({
			main: this
		})
	});

	// Set keep alive timeout to 5 seconds
	this.server.on('connection', function (socket) {
		socket.setTimeout(5000);
	});

	// Catch runtime errors
	this.server.on('error', function (error) {
		console.log('simpleS: Server Error\n' + error.message + '\n');
		that.started  = false;
		that.busy = false;
	});

	// Inform when the server is not busy
	this.server.on('release', function (callback) {
		that.busy = false;
		if (callback) {
			callback.call(that);
		}
	});

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
simples.prototype.engine = function (engine, render) {
	'use strict';

	// Prepare template engine
	this.server.engine = engine;

	// Choose the rendering method
	if (render) {
		this.server.render = engine[render];
	} else if (engine.render) {
		this.server.render = engine.render;
	} else {
		this.server.render = engine;
	}

	return this;
};

// Create a new host
simples.prototype.host = function (name) {
	'use strict';

	// Create the new host and save it to the hosts object
	this.server.hosts[name] = new host(name);
	this.server.hosts[name].parent = this;
	return this.server.hosts[name];
};

// Start simples server
simples.prototype.start = function (port, callback) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Set the server to listen the port
	function listen() {

		// Start all existing hosts
		for (var i in that.server.hosts) {
			that.server.hosts[i].open();
		}

		process.once('SIGINT', that.sigintListener);
		that.server.listen(port, function () {
			getSessions(that, callback);
		});
	}

	// Start or restart the server
	function start() {
		that.busy = true;
		if (that.started) {
			that.server.close(listen);
		} else {
			that.started = true;
			listen();
		}
		
	}

	// If the server is busy wait for release
	if (this.busy) {
		this.server.once('release', start);
	} else {
		start();
	}

	return this;
};

// Stop simpleS server
simples.prototype.stop = function (callback) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Stop the server
	function stop() {

		// Stop all existing hosts
		for (var i in that.server.hosts) {
			that.server.hosts[i].close();
		}

		process.removeListener('SIGINT', that.sigintListener);
		that.started = false;
		that.busy = true;
		that.server.close(function () {
			saveSessions(that, callback);
		});
	}

	// Stop the server only if it is running
	if (this.started && this.busy) {
		this.server.once('release', stop);
	} else if (this.started) {
		stop();
	}

	return this;
};