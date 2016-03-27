'use strict';

var events = require('events'),
	utils = require('simples/utils/utils');

// Mirror prototype constructor
var Mirror = function (server, options) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define the private properties for the mirror
	Object.defineProperties(this, {
		backlog: {
			value: options.backlog
		},
		busy: {
			value: false,
			writable: true
		},
		hostname: {
			value: options.hostname
		},
		destroyed: {
			value: false,
			writable: true
		},
		instance: {
			value: utils.createInstance(this, options)
		},
		server: {
			value: server
		},
		port: {
			value: options.port,
			writable: true
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Add server's listeners to the mirror
	this.instance.on('request', server.requestListener);
	this.instance.on('upgrade', server.upgradeListener);
};

// Inherit from events.EventEmitter
Mirror.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Mirror
	}
});

// Destroy the mirror
Mirror.prototype.destroy = function (callback) {

	var that = this;

	// Stop the mirror and then destroy it
	this.stop(function () {
		that.destroyed = true;
		delete that.server.mirrors[that.port];
		utils.runFunction(callback);
	});
};

// Start or restart the mirror
Mirror.prototype.start = function (port, callback) {

	var that = this;

	// Set the internal instance to listen the defined port
	function start() {

		var args = [],
			instance = that.instance;

		// Set the port and the status flags
		that.busy = true;
		that.port = port;
		that.started = true;

		// Add the port to the arguments
		args.push(port);

		// If there is a hostname defined add it to the arguments
		if (that.hostname) {
			args.push(that.hostname);
		}

		// If there is a backlog defined add it to the arguments
		if (that.backlog) {
			args.push(that.backlog);
		}

		// Add the callback to listen the server start
		args.push(function () {
			that.busy = false;
			utils.runFunction(callback, that);
			that.emit('start', that);
			that.emit('release');
		});

		// Start listening by applying the defined arguments
		instance.listen.apply(instance, args);
	}

	// Make parameters optional
	if (typeof port === 'function') {
		callback = port;
		port = this.port;
	} else if (typeof port !== 'number') {
		port = this.port;
		callback = null;
	}

	// Check for the internal instance status and start or restart it
	if (!this.destroyed) {
		if (this.busy) {
			this.once('release', function () {
				that.start(port, callback);
			});
		} else if (this.started && port !== this.port) {
			this.stop(start);
		} else {
			start();
		}
	}

	return this;
};

// Stop the mirror
Mirror.prototype.stop = function (callback) {

	var that = this;

	// Check for the internal instance status and stop it only if it is started
	if (!this.destroyed) {
		if (this.busy) {
			this.once('release', function () {
				that.stop(callback);
			});
		} else if (this.started) {

			// Set status flags
			this.busy = true;
			this.started = false;

			// Close the internal instance
			this.instance.close(function () {
				that.busy = false;
				utils.runFunction(callback, that);
				that.emit('stop', that);
				that.emit('release');
			});
		} else {
			utils.runFunction(callback, this);
		}
	}

	return this;
};

module.exports = Mirror;