'use strict';

var events = require('events'),
	ServerMixin = require('simples/lib/mixins/server-mixin.js'),
	utils = require('simples/utils/utils');

// Mirror prototype constructor
var Mirror = function (server, options, callback) {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define the private properties for the mirror
	Object.defineProperties(this, {
		destroyed: {
			value: false,
			writable: true
		},
		server: {
			value: server
		},
		requestListener: {
			value: server.requestListener
		},
		upgradeListener: {
			value: server.upgradeListener
		}
	});

	// Call ServerMixin in this context
	ServerMixin.call(this, options, callback);
};

// Mirror factory function
Mirror.create = function (server, options, callback) {

	return new Mirror(server, options, callback);
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

	// Check if the mirror is not destroyed to start or restart it
	if (!this.destroyed) {
		ServerMixin.startServer(this, port, callback);
	}

	return this;
};

// Stop the mirror
Mirror.prototype.stop = function (callback) {

	// Check if the mirror is not destroyed to stop it
	if (!this.destroyed) {
		ServerMixin.stopServer(this, callback);
	}

	return this;
};

module.exports = Mirror;