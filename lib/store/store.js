'use strict';

const MemoryStore = require('simples/lib/store/memory-store');

const { minute } = require('simples/lib/utils/constants');

const notImplementedError = Error('Not Implemented');

class Store {

	// Store constructor, should be called only from Store.create()
	constructor(config) {

		// Define session store private options
		this._options = Store.optionsContainer(config);
	}

	// Get session data from the store
	get(id) {

		return new Promise((resolve, reject) => {
			if (this._options.get) {
				this._options.get(id, (error, session) => {
					if (error) {
						reject(error);
					} else {
						resolve(session);
					}
				});
			} else {
				reject(notImplementedError);
			}
		});
	}

	// Save session data to the store
	set(id, session) {

		return new Promise((resolve, reject) => {
			if (this._options.set) {
				this._options.set(id, session, (error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			} else {
				reject(notImplementedError);
			}
		});
	}

	// Remove session data from the store
	unset(id) {

		return new Promise((resolve, reject) => {
			if (this._options.unset) {
				this._options.unset(id, (error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			} else {
				reject(notImplementedError);
			}
		});
	}

	// Store factory method
	static create(config) {

		// Check for invalid config to create the memory store configuration
		if (!config || typeof config !== 'object') {
			config = MemoryStore.createConfig(minute);
		}

		return new Store(config);
	}

	// Create a frozen options object container
	static optionsContainer(config) {

		const container = {};

		// Check for store get method implementation
		if (typeof config.get === 'function') {
			container.get = config.get;
		}

		// Check for store set method implementation
		if (typeof config.set === 'function') {
			container.set = config.set;
		}

		// Check for store unset method implementation
		if (typeof config.unset === 'function') {
			container.unset = config.unset;
		}

		return container;
	}
}

module.exports = Store;