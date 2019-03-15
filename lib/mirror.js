'use strict';

const ServerUtils = require('simples/lib/utils/server-utils');

const { EventEmitter } = require('events');

class Mirror extends EventEmitter {

	/**
	 * Mirror constructor
	 * @param {Server} server
	 * @param {number} port
	 * @param {MirrorOptions} options
	 * @param {MirrorCallback} callback
	 */
	constructor(server, port, options, callback) {

		const args = ServerUtils.prepareServerArgs(port, options, callback);

		const {
			requestListener,
			upgradeListener
		} = ServerUtils.getServerMeta(server);

		super();

		// Define mirror public properties
		this.data = {};

		// Set server meta data
		ServerUtils.setServerMeta(this, args.options, {
			requestListener,
			upgradeListener
		});

		// Initialize the mirror
		ServerUtils.initServer(this, args.callback);
	}

	/**
	 * Start or restart the mirror
	 * @param {number} port
	 * @param {MirrorCallback} callback
	 * @returns {Mirror}
	 */
	start(port, callback) {

		return ServerUtils.startServer(this, port, callback);
	}

	/**
	 * Stop the mirror
	 * @param {MirrorCallback} callback
	 * @returns {Mirror}
	 */
	stop(callback) {

		return ServerUtils.stopServer(this, callback);
	}
}

module.exports = Mirror;