'use strict';

const {
	startServer,
	stopServer
} = require('simples/lib/utils/server-utils');

module.exports = (SuperClass) => class ServerMixin extends SuperClass {

	/**
	 * Start or restart the server
	 * @param {number} port
	 * @param {ServerCallback} callback
	 * @returns {this}
	 */
	start(port, callback) {

		return startServer(this, port, callback);
	}

	/**
	 * Stop the server
	 * @param {ServerCallback} callback
	 * @returns {this}
	 */
	stop(callback) {

		return stopServer(this, callback);
	}
};