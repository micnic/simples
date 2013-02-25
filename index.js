var host = require('./lib/host');
var server = require('./lib/server');
var utils = require('./utils/utils');

// SimpleS prototype constructor
var simples = module.exports = function (port, options) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port, options);
	}

	// Call host in this context and set it as the main host
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
		server: {
			value: server(this, options)
		},
		sigintListener: {
			value: sigintListener
		},
		started: {
			value: false,
			writable: true
		}
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

		// Bind the manual stop listener
		process.once('SIGINT', that.sigintListener);

		// Start all existing hosts
		for (var i in that.server.hosts) {
			that.server.hosts[i].open();
		}

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
			utils.getSessions(that.server, listen);
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

		// Set status flags
		that.started = false;
		that.busy = true;

		// Unbind the manual stop listener
		process.removeListener('SIGINT', that.sigintListener);

		// Close all existing hosts
		for (var i in that.server.hosts) {
			that.server.hosts[i].close();
		}

		// Close the server
		that.server.close(function () {
			utils.saveSessions(that.server, callback);
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