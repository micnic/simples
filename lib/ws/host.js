'use strict';

const Config = require('simples/lib/utils/config');
const Route = require('simples/lib/route');
const Broadcaster = require('simples/lib/ws/broadcaster');
const Channel = require('simples/lib/ws/channel');

const { megabyte, wsTimeout } = require('simples/lib/utils/constants');

class WSHost extends Broadcaster {

	constructor(router, location, config, listener) {

		const options = WSHost.optionsContainer(config);
		const routes = router._host._routes.ws;

		super(options.advanced);

		// Define WS host private properties
		this._channels = new Map();
		this._options = options;
		this._parent = router;

		// Add Route mixin to this context
		Route.mixin(this, location, listener);

		// Add the host to the hosts container based on its type
		if (this.dynamic) {
			routes.dynamic.set(location, this);
		} else {
			routes.fixed.set(location, this);
		}
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
				channel = new Channel(this, name);
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