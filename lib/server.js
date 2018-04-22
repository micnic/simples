'use strict';

const HttpHost = require('simples/lib/http/host');
const HttpUtils = require('simples/lib/utils/http-utils');
const Mirror = require('simples/lib/mirror');
const ServerUtils = require('simples/lib/utils/server-utils');
const url = require('url');
const WsUtils = require('simples/lib/utils/ws-utils');

const httpProtocol = 'http'; // HTTP protocol name
const mainHostName = 'main'; // The name of the server as the main host
const securedProtocolSuffix = 's'; // Suffix for secured protocols
const wsProtocol = 'ws'; // WS protocol name

class Server extends HttpHost {

	constructor(options, callback) {

		super(mainHostName, options.config);

		// Define server private properties
		this._hosts = Server.hostsContainer();
		this._mirrors = new Map();
		this._requestListener = Server.requestListener(this);
		this._upgradeListener = Server.upgradeListener(this);

		// Initialize the server with the provided options
		ServerUtils.initServer(this, options, callback);
	}

	// Create a new host or return an existing one
	host(name, options) {

		// Check for a valid host name
		if (typeof name === 'string' && name.length > 0) {

			const hosts = this._hosts;

			// Check for existing host or create a new one
			if (hosts.fixed.has(name)) {
				return hosts.fixed.get(name);
			} else if (hosts.dynamic.has(name)) {
				return hosts.dynamic.get(name);
			} else {
				return HttpHost.create(this, name, options);
			}
		} else {
			throw TypeError('"name" argument should be a non-empty string');
		}
	}

	// Create a new mirror or return an existing one
	mirror(port, options, callback) {

		const args = ServerUtils.normalizeServerArgs(port, options, callback);
		const mirrors = this._mirrors;

		// Check for existing mirror and select it or create a new one
		if (mirrors.has(args.port)) {
			return mirrors.get(args.port);
		} else {
			return Mirror.create(this, args.options, args.callback);
		}
	}

	// Start or restart the server
	start(port, callback) {

		// Start or the server instance
		ServerUtils.startServer(this, port, callback);

		return this;
	}

	// Stop the server
	stop(callback) {

		// Stop the server instance
		ServerUtils.stopServer(this, callback);

		return this;
	}

	// Server factory method
	static create(port, options, callback) {

		const args = ServerUtils.normalizeServerArgs(port, options, callback);

		return new Server(args.options, args.callback);
	}

	// Get a HTTP or WS host if it exists
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

	// Get an existent HTTP host or the main HTTP host
	static getHttpHost(server, request) {

		let host = server;

		// Check for HTTP host header
		if (request.headers.host) {

			const name = Server.getHttpHostName(request.headers.host);

			// Search for the HTTP host in the hosts container
			host = Server.getHost(server._hosts, name, host);
		}

		return host;
	}

	// Strip port value from the host header to get the host name
	static getHttpHostName(header) {

		return header.replace(/:\d+$/, '');
	}

	// Get parsed request url
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
			protocol += securedProtocolSuffix;
		}

		return url.parse(`${protocol}://${address}`);
	}

	// Get an existing WS host
	static getWsHost(server, name, request) {

		const httpHost = Server.getHttpHost(server, request);

		return Server.getHost(httpHost._routes.ws, name, null);
	}

	// Create a hosts objects container
	static hostsContainer() {

		return {
			dynamic: new Map(),
			fixed: new Map()
		};
	}

	// Return a listener for HTTP requests
	static requestListener(server) {

		return (request, response) => {

			const location = Server.getRequestLocation(request, httpProtocol);
			const host = Server.getHttpHost(server, request);

			// Process the received request
			HttpUtils.httpConnectionListener(host, location, request, response);
		};
	}

	// Return a listener for WS requests
	static upgradeListener(server) {

		return (request, socket) => {

			const location = Server.getRequestLocation(request, wsProtocol);
			const host = Server.getWsHost(server, location.pathname, request);

			// Check for a defined WebSocket host and process received request
			if (host) {
				WsUtils.wsConnectionListener(host, location, request);
			} else {
				socket.destroy();
			}
		};
	}
}

module.exports = Server;