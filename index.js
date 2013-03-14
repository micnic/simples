var fs = require('fs');
var http = require('http');
var https = require('https');

var host = require('./lib/host');
var utils = require('./utils/utils');
var ws = require('./lib/ws');

// SimpleS prototype constructor
var simples = module.exports = function (port, options) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port, options);
	}

	// Call host in this context and set it as the main host
	host.call(this, 'main');

	var that = this;
	var server;

	// Prepare the server
	if (options && options.key && options.cert) {
		var key;
		var cert;

		// Create the key and the certificate
		try {
			key = fs.readFileSync(options.key);
			cert = fs.readFileSync(options.cert);
		} catch (error) {
			console.log('simpleS: Could not read data for HTTPS');
			console.log('HTTP server will be created on port ' + port);
			console.log(error.message + '\n');
			server = http.Server(utils.handleHTTPRequest);
			return;
		}

		// Add the content of the key and the certificate
		options = {
			key: key,
			cert: cert
		};

		server = https.Server(options, utils.handleHTTPRequest);
	} else {
		server = http.Server(utils.handleHTTPRequest);
	}

	// Container for caching static files content
	server.cache = {};

	// The hosts of the server
	server.hosts = {
		main: this
	};

	// Catch runtime errors
	server.on('error', function (error) {
		console.log('simpleS: Server Error');
		console.log(error.message + '\n');
		that.started  = false;
		that.busy = false;
	});

	// Inform when the server is not busy
	server.on('release', function (callback) {
		that.busy = false;
		if (callback) {
			callback.call(that);
		}
	});

	// Listen for upgrade connections dedicated for WebSocket
	server.on('upgrade', ws);

	// Set simpleS properties
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		server: {
			value: server
		},
		started: {
			value: false,
			writable: true
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
	if (this.busy && this.started) {
		this.server.once('release', stop);
	} else if (this.started) {
		stop();
	}

	return this;
};