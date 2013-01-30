var fs = require('fs');
var path = require('path');

var host = require('./lib/host');
var server = require('./lib/server');

var dirname = path.dirname(module.parent.filename);

// Will get sessions from file
function getSessions(server, callback) {
	'use strict';

	var sessions;

	// Activate the sessions from the file
	function activateSessions() {
		for (var i in server.hosts) {
			server.hosts[i].setSessions(sessions[i]);
		}
	}

	// Read and parse the sessions file
	fs.readFile(dirname + '/.sessions', 'utf8', function (error, data) {

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

		callback();
	});
}

// Will save sessions to file
function saveSessions(server, callback) {
	'use strict';

	var sessions = {};

	// Select and deactivate sessions
	for (var i in server.hosts) {
		sessions[i] = server.hosts[i].getSessions();
	}

	// Prepare sessions for writing on file
	sessions = JSON.stringify(sessions);

	// Write the sessions in the file
	fs.writeFile(dirname + '/.sessions', sessions, 'utf8', function (error) {
		
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

	// Listener for manual stop
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

		// Bind the manual stop listener
		process.once('SIGINT', that.sigintListener);

		// Start listening the port
		that.server.listen(port, function () {
			that.server.emit('release', callback);
		});
	}

	// Start or restart the server
	function start() {
		that.busy = true;
		if (that.started) {
			that.server.close(listen);
		} else {
			that.started = true;
			getSessions(that.server, listen);
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

		// Unbind the manual stop listener
		process.removeListener('SIGINT', that.sigintListener);
		that.started = false;
		that.busy = true;

		// Close the server
		that.server.close(function () {
			saveSessions(that.server, callback);
		});
	}

	// Stop the server only if it is running
	if (this.started) {
		if (this.busy) {
			this.server.once('release', stop);
		} else {
			stop();
		}
	}

	return this;
};