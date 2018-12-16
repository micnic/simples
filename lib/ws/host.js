'use strict';

const Config = require('simples/lib/utils/config');
const Route = require('simples/lib/route');
const WSChannel = require('simples/lib/ws/channel');
const WSFormatter = require('simples/lib/utils/ws-formatter');

const { EventEmitter } = require('events');
const { megabyte, wsTimeout } = require('simples/lib/utils/constants');

class WSHost extends EventEmitter {

	constructor(router, location, config, listener) {

		super();

		// Define WS host public properties
		this.connections = new Set();

		// Define WS host private properties
		this._channels = new Map();
		this._options = WSHost.optionsContainer(config);
		this._advanced = this._options.advanced;
		this._parent = router;

		// Add Route mixin to this context
		Route.mixin(this, location, listener);
	}

	// Send data to all active connections or a part of them
	broadcast(event, data, filter) {

		// Broadcast formatted message to the connections
		WSFormatter.broadcast(this, event, data, filter);

		return this;
	}

	// Return a channel for grouping connections
	channel(name, filter) {

		let channel = null;

		// Validate name and select the channel
		if (typeof name === 'string') {

			const channelsContainer = this._channels;

			// Check if the channel does not exist already
			if (channelsContainer.has(name)) {
				channel = channelsContainer.get(name);
			} else {
				channel = WSChannel.create(this, name);
				channelsContainer.set(name, channel);
			}

			// Add connections to the channel
			if (typeof filter === 'function') {
				this.connections.forEach((connection, index, array) => {
					if (filter(connection, index, array)) {
						channel.bind(connection);
					}
				});
			}
		}

		return channel;
	}

	// WS host factory method
	static create(router, location, config, listener) {

		const host = new WSHost(router, location, config, listener);
		const routes = router._host._routes.ws;

		// Add the host to the hosts container based on its type
		if (host.dynamic) {
			routes.dynamic.set(location, host);
		} else {
			routes.fixed.set(location, host);
		}

		return host;
	}

	// Create a sealed options object
	static optionsContainer(config) {

		return Config.getConfig({
			advanced: {
				type: Config.types.boolean
			},
			limit: {
				default: megabyte,
				type: Config.types.number
			},
			origins: {
				default: [],
				type: Config.types.array
			},
			timeout: {
				default: wsTimeout,
				type: Config.types.number
			}
		}, config);
	}
}

module.exports = WSHost;