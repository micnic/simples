'use strict';

const HTTPHost = require('simples/lib/http/host');
const Mirror = require('simples/lib/mirror');
const ServerMixin = require('simples/lib/server-mixin');
const MapContainer = require('simples/lib/utils/map-container');
const {
	getServerMeta,
	initServer,
	isHTTPHostNameDynamic,
	prepareServerArgs,
	requestListener,
	upgradeListener
} = require('simples/lib/utils/server-utils');

const mainHostName = 'main'; // The name of the server as the main host

class Server extends ServerMixin(HTTPHost) {

	/**
	 * Server constructor
	 * @param {number} port
	 * @param {ServerOptions} options
	 * @param {ServerCallback} callback
	 */
	constructor(port, options, callback) {

		const args = prepareServerArgs(port, options, callback);

		super(mainHostName);

		// Create an HTTP hosts container
		this._hosts = MapContainer.dynamic();

		// Set server meta data
		this._meta = getServerMeta(args.options, {
			requestListener: requestListener(this),
			upgradeListener: upgradeListener(this)
		});

		// Initialize the server
		initServer(this, args.callback);
	}

	/**
	 * Create a new HTTP host
	 * @param {string} name
	 * @returns {HTTPHost}
	 */
	host(name) {

		// Validate host name
		if (typeof name === 'string') {

			const host = new HTTPHost(name);
			const hosts = this._hosts;

			// Add the host to the hosts container based on its type
			if (isHTTPHostNameDynamic(name)) {
				hosts.dynamic.set(name, host);
			} else {
				hosts.fixed.set(name, host);
			}

			return host;
		}

		return null;
	}

	/**
	 * Create a new mirror
	 * @param {number} port
	 * @param {ServerOptions} options
	 * @param {MirrorCallback} callback
	 * @returns {Mirror}
	 */
	mirror(port, options, callback) {

		return new Mirror(this, port, options, callback);
	}
}

module.exports = Server;