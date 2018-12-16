'use strict';

const ServerUtils = require('simples/lib/utils/server-utils');

const { EventEmitter } = require('events');

class Mirror extends EventEmitter {

	/**
	 * Mirror constructor
	 */
	constructor() {

		super();

		// Define mirror public properties
		this.data = {};
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

	/**
	 * Mirror factory method
	 * @param {Server} server
	 * @param {number} port
	 * @param {MirrorOptions} options
	 * @param {MirrorCallback} callback
	 * @returns {Mirror}
	 */
	static create(server, port, options, callback) {

		const args = ServerUtils.prepareServerArgs(port, options, callback);
		const mirror = new Mirror();

		const {
			requestListener,
			upgradeListener
		} = ServerUtils.getServerMeta(server);

		// Set server meta data
		ServerUtils.setServerMeta(mirror, args.options, {
			requestListener,
			upgradeListener
		});

		return ServerUtils.initServer(mirror, args.callback);
	}
}

module.exports = Mirror;