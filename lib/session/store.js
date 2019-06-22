'use strict';

const MemoryStore = require('simples/lib/session/memory-store');

// Error thrown when an implemented method does not return a promise
const noPromiseError = Error('No promise result');

// Error thrown when a method is expected to be implemented
const notImplementedError = Error('Not implemented');

class Store {

	/**
	 * Store constructor
	 * @param {StoreOptions} config
	 */
	constructor(config = MemoryStore.createConfig()) {

		// Define session store private options
		this._options = Store.optionsContainer(config);
	}

	/**
	 * Get session data from the store
	 * @param {string} id
	 * @returns {Promise}
	 */
	get(id) {

		return Store.tryImplementation(this._options.get, id);
	}

	/**
	 * Save session data to the store
	 * @param {string} id
	 * @param {*} session
	 * @returns {Promise}
	 */
	set(id, session) {

		return Store.tryImplementation(this._options.set, id, session);
	}

	/**
	 * Remove session data from the store
	 * @param {string} id
	 * @returns {Promise}
	 */
	unset(id) {

		return Store.tryImplementation(this._options.unset, id);
	}

	/**
	 * Try the implementation of an expected method
	 * @param {(...args: *[]) => Promise<*>} method
	 * @param {*[]} args
	 * @returns {Promise<*>}
	 */
	static tryImplementation(method, ...args) {

		// Check the provided method
		if (method) {
			try {

				const result = method(...args);

				// Check if the result of the method call is a promise
				if (result instanceof Promise) {
					return result;
				}

				return Promise.reject(noPromiseError);
			} catch (error) {
				return Promise.reject(error);
			}
		}

		return Promise.reject(notImplementedError);
	}

	/**
	 * Create a store options object container
	 * @param {StoreOptions} config
	 * @returns {StoreOptions}
	 */
	static optionsContainer(config) {

		const container = {};

		// Check if any config is provided
		if (config) {

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
		}

		return container;
	}
}

module.exports = Store;