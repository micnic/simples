'use strict';

const HTTPHost = require('simples/lib/http/host');
const HTTPUtils = require('simples/lib/utils/http-utils');
const MapContainer = require('simples/lib/utils/map-container');
const Mirror = require('simples/lib/mirror');
const Router = require('simples/lib/http/router');
const ServerUtils = require('simples/lib/utils/server-utils');
const url = require('url');
const WSUtils = require('simples/lib/utils/ws-utils');

const mainHostName = 'main'; // The name of the server as the main host

const HTTPHosts = new Map(); // Container for HTTP hosts collections

class Server extends HTTPHost {

	/**
	 * Server constructor
	 */
	constructor() {

		super(mainHostName);
	}

	/**
	 * Create a new HTTP host
	 * @param {string} name
	 * @param {RouterOptions} options
	 * @returns {HTTPHost}
	 */
	host(name, options) {

		// Validate host name
		if (typeof name === 'string') {

			const host = HTTPHost.create(name, options);
			const hosts = Server.getHTTPHosts(this);

			// Add the host to the hosts container based on its type
			if (HTTPHost.isDynamic(name)) {
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
	 * @param {MirrorOptions} options
	 * @param {MirrorCallback} callback
	 * @returns {Mirror}
	 */
	mirror(port, options, callback) {

		return Mirror.create(this, port, options, callback);
	}

	/**
	 * Start or restart the server
	 * @param {number} port
	 * @param {ServerCallback} callback
	 * @returns {Server}
	 */
	start(port, callback) {

		return ServerUtils.startServer(this, port, callback);
	}

	/**
	 * Stop the server
	 * @param {ServerCallback} callback
	 * @returns {Server}
	 */
	stop(callback) {

		return ServerUtils.stopServer(this, callback);
	}

	/**
	 * Server factory method
	 * @param {number} port
	 * @param {ServerOptions} options
	 * @param {ServerCallback} callback
	 * @returns {Server}
	 */
	static create(port, options, callback) {

		const args = ServerUtils.prepareServerArgs(port, options, callback);
		const server = new Server();
		const requestListener = Server.requestListener(server);
		const upgradeListener = Server.upgradeListener(server);

		// Set server HTTP hosts
		Server.setHTTPHosts(server);

		// Set router options for the main router
		Router.setOptions(server, args.options.config);

		// Set server meta data
		ServerUtils.setServerMeta(server, args.options, {
			requestListener,
			upgradeListener
		});

		return ServerUtils.initServer(server, args.callback);
	}

	/**
	 * Get a HTTP or WS host if it exists
	 * @param {MapContainer} hostsContainer
	 * @param {string} name
	 * @param {Host} mainHost
	 */
	static getHost(hostsContainer, name, mainHost) {

		// Check in fixed hosts, then search in the dynamic hosts
		if (hostsContainer.fixed.has(name)) {
			return hostsContainer.fixed.get(name);
		} else {
			for (const host of hostsContainer.dynamic.values()) {
				if (host._pattern.test(name)) {
					return host;
				}
			}
		}

		return mainHost;
	}

	/**
	 * Get an existent HTTP host or the main HTTP host
	 * @param {Server} server
	 * @param {Request} request
	 * @returns {HTTPHost}
	 */
	static getHTTPHost(server, request) {

		const hostname = request.headers.host;

		// Check for HTTP host header
		if (hostname) {

			const hosts = Server.getHTTPHosts(server);
			const name = Server.getHTTPHostName(hostname);

			return Server.getHost(hosts, name, server);
		}

		return server;
	}

	/**
	 * Strip port value from the host header to get the host name
	 * @param {string} header
	 * @returns {string}
	 */
	static getHTTPHostName(header) {

		return header.replace(/:\d+$/, '');
	}

	/**
	 * Get the HTTP hosts container of the server
	 * @param {Server} server
	 * @returns {MapContainer}
	 */
	static getHTTPHosts(server) {

		return HTTPHosts.get(server);
	}

	/**
	 * Get parsed request url
	 * @param {Request} request
	 * @param {string} protocol
	 * @returns {URL}
	 */
	static getRequestLocation(request, protocol) {

		let address = request.connection.localAddress;

		// Check if the host header is present
		if (request.headers.host) {
			address = request.headers.host;
		}

		// Append request url to the address
		address += request.url;

		// Check for secured protocol
		if (request.connection.encrypted) {

			const securedProtocolSuffix = 's'; // Suffix for secured protocols

			// Add the secured protocol suffix to the protocol
			protocol += securedProtocolSuffix;
		}

		return url.parse(`${protocol}://${address}`);
	}

	/**
	 * Get an existing WS host
	 * @param {Server} server
	 * @param {RequestLocation} location
	 * @param {Request} request
	 * @returns {WSHost}
	 */
	static getWSHost(server, location, request) {

		const {
			_routes: {
				ws: hosts
			}
		} = Server.getHTTPHost(server, request);

		return Server.getHost(hosts, location.pathname, null);
	}

	/**
	 * Return a listener for HTTP requests
	 * @param {Server} server
	 * @returns {RequestListener}
	 */
	static requestListener(server) {

		const protocol = 'http'; // HTTP protocol name

		return (request, response) => {

			const location = Server.getRequestLocation(request, protocol);
			const host = Server.getHTTPHost(server, request);

			// Process the received request
			HTTPUtils.connectionListener(host, location, request, response);
		};
	}

	/**
	 * Create and set a HTTP hosts container
	 * @param {Server} server
	 */
	static setHTTPHosts(server) {
		HTTPHosts.set(server, MapContainer.dynamic());
	}

	/**
	 * Return a listener for WS requests
	 * @param {Server} server
	 * @returns {UpgradeListener}
	 */
	static upgradeListener(server) {

		const protocol = 'ws'; // WS protocol name

		return (request, socket) => {

			const location = Server.getRequestLocation(request, protocol);
			const host = Server.getWSHost(server, location, request);

			// Check for a defined WebSocket host and process received request
			if (host) {
				WSUtils.connectionListener(host, location, request);
			} else {
				socket.destroy();
			}
		};
	}
}

module.exports = Server;