'use strict';

const { EventEmitter } = require('events');
const ServerMixin = require('simples/lib/server-mixin');
const {
	getServerMeta,
	initServer,
	prepareServerArgs
} = require('simples/lib/utils/server-utils');

class Mirror extends ServerMixin(EventEmitter) {

	/**
	 * Mirror constructor
	 * @param {Server} server
	 * @param {number} port
	 * @param {ServerOptions} options
	 * @param {MirrorCallback} callback
	 */
	constructor(server, port, options, callback) {

		const args = prepareServerArgs(port, options, callback);

		const {
			requestListener,
			upgradeListener
		} = server._meta;

		super();

		// Define mirror public properties
		this.data = {};

		// Define mirror private properties
		this._meta = getServerMeta(args.options, {
			requestListener,
			upgradeListener
		});

		// Initialize the mirror
		initServer(this, args.callback);
	}
}

module.exports = Mirror;