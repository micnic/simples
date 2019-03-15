'use strict';

const MemoryStore = require('simples/lib/store/memory-store');

const { minute } = require('simples/lib/utils/constants');

const notImplementedError = Error('Not Implemented');

class Store {

	/**
	 * Store constructor
	 * @param {StoreOptions} config
	 */
	constructor(config) {

		// Check for invalid config to create the memory store configuration
		if (!config || typeof config !== 'object') {
			config = MemoryStore.createConfig(minute);
		}

		// Define session store private options
		this._options = Store.optionsContainer(config);
	}

	/**
	 * Get session data from the store
	 * @param {string} id
	 * @returns {Promise}
	 */
	get(id) {

		// Check if the options have get method provided
		if (this._options.get) {
			try {
				return this._options.get(id);
			} catch (error) {
				return Promise.reject(error);
			}
		} else {
			return Promise.reject(notImplementedError);
		}
	}

	/**
	 * Save session data to the store
	 * @param {string} id
	 * @param {*} session
	 * @returns {Promise}
	 */
	set(id, session) {

		// Check if the options have set method provided
		if (this._options.set) {
			try {
				return this._options.set(id, session);
			} catch (error) {
				return Promise.reject(error);
			}
		} else {
			return Promise.reject(notImplementedError);
		}
	}

	/**
	 * Remove session data from the store
	 * @param {string} id
	 * @returns {Promise}
	 */
	unset(id) {

		// Check if the options have unset method provided
		if (this._options.unset) {
			try {
				return this._options.unset(id);
			} catch (error) {
				return Promise.reject(error);
			}
		} else {
			return Promise.reject(notImplementedError);
		}
	}

	/**
	 * Create a store options object container
	 * @param {StoreOptions} config
	 * @returns {StoreOptions}
	 */
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