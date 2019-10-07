'use strict';

const MemoryStore = require('simples/lib/session/memory-store');

// Error thrown when an implemented method does not return a promise
const noPromise = 'No promise result';

// Error message thrown when a method is expected to be implemented
const notImplemented = 'Not implemented';

/**
 * Try the implementation of an expected method
 * @param {(...args: *[]) => Promise<*>} method
 * @param {*[]} args
 * @returns {Promise<*>}
 */
const tryImplementation = (method, ...args) => {

	// Check the provided method
	if (method) {
		try {

			const result = method(...args);

			// Check if the result of the method call is a promise
			if (result instanceof Promise) {
				return result;
			}

			return Promise.reject(Error(noPromise));
		} catch (error) {
			return Promise.reject(error);
		}
	}

	return Promise.reject(Error(notImplemented));
};

class Store {

	/**
	 * Store constructor
	 * @param {StoreOptions} config
	 */
	constructor(config = MemoryStore.createConfig()) {

		this._options = {};

		// Check if any config is provided
		if (config) {

			// Check for store get method implementation
			if (typeof config.get === 'function') {
				this._options.get = config.get;
			}

			// Check for store set method implementation
			if (typeof config.set === 'function') {
				this._options.set = config.set;
			}

			// Check for store remove method implementation
			if (typeof config.remove === 'function') {
				this._options.remove = config.remove;
			}

			// Check for store update method implementation
			if (typeof config.update === 'function') {
				this._options.update = config.update;
			}
		}
	}

	/**
	 * Get session data from the store
	 * @param {string} id
	 * @returns {Promise<Session<*>>}
	 */
	get(id) {

		return tryImplementation(this._options.get, id);
	}

	/**
	 * Remove session data from the store
	 * @param {string} id
	 * @returns {Promise<*>}
	 */
	remove(id) {

		return tryImplementation(this._options.remove, id);
	}

	/**
	 * Save session data to the store
	 * @param {string} id
	 * @param {Session<*>} session
	 * @param {number} timeout
	 * @returns {Promise<*>}
	 */
	set(id, session, timeout) {

		return tryImplementation(this._options.set, id, session, timeout);
	}

	/**
	 * Update expiration time of the session data into the store
	 * @param {string} id
	 * @param {number} timeout
	 * @returns {Promise<*>}
	 */
	update(id, timeout) {

		return tryImplementation(this._options.update, id, timeout);
	}
}

module.exports = Store;