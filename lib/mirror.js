'use strict';

const ServerUtils = require('simples/lib/utils/server-utils');

const { EventEmitter } = require('events');

class Mirror extends EventEmitter {

	constructor(server, options, callback) {

		super();

		// Define mirror public properties
		this.data = {};

		// Define mirror private properties
		this._requestListener = server._requestListener;
		this._upgradeListener = server._upgradeListener;

		// Initialize the mirror
		ServerUtils.initServer(this, options, callback);
	}

	// Start or restart the mirror
	start(port, callback) {

		// Start or the mirror instance
		ServerUtils.startServer(this, port, callback);

		return this;
	}

	// Stop the mirror
	stop(callback) {

		// Stop the mirror instance
		ServerUtils.stopServer(this, callback);

		return this;
	}

	// Mirror factory method
	static create(server, options, callback) {

		const mirror = new Mirror(server, options, callback);

		// Add the mirror to the server
		server._mirrors.set(options.port, mirror);

		return mirror;
	}
}

module.exports = Mirror;