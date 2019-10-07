'use strict';

const crypto = require('crypto');

const { keys } = Object;

const sessionIdLength = 16; // Length of session id buffer

class Session extends Map {

	/**
	 * Session constructor
	 * @param {Store} store
	 * @param {string} id
	 * @param {number} timeout
	 */
	constructor(store, id = '', timeout) {

		super();

		// Define session public properties
		this.changed = false;
		this.id = id;
		this.store = store;
		this.timeout = timeout;
	}

	/**
	 * Load the session from the store
	 * @returns {Promise<void>}
	 */
	async load() {

		// Check for session id to get session from the store
		if (this.id) {

			const entries = await this.store.get(this.id);

			// Check if there is available session data in the store
			if (entries) {

				// Clear all session data before getting it from the store
				this.clear();

				// Populate session entries
				keys(entries).forEach((key) => {
					this.set(key, entries[key]);
				});

				// Set changed flag
				this.changed = false;

				return Promise.resolve();
			}

			return this.generate();
		}

		return this.generate();
	}

	/**
	 * Remove all session entries
	 */
	clear() {

		// Check for the size of the entries before removing them
		if (this.size) {
			super.clear();
			this.changed = true;
		}
	}

	/**
	 * Remove an entry of the session
	 * @param {string} key
	 * @returns {boolean}
	 */
	delete(key) {

		const result = super.delete(key);

		// Check if entry was removed
		if (result) {
			this.changed = true;
		}

		return result;
	}

	/**
	 * Remove session from the store
	 * @returns {Promise<void>}
	 */
	destroy() {

		return this.store.remove(this.id);
	}

	/**
	 * Generate new session id
	 * @returns {Promise<void>}
	 */
	generate() {

		return new Promise((resolve, reject) => {

			// Generate random session id
			crypto.randomBytes(sessionIdLength, (error, id) => {
				if (error) {
					reject(error);
				} else {

					// Generate session id and mark the session as changed
					this.changed = true;
					this.id = id.toString('hex');

					// Resolve promise
					resolve();
				}
			});
		});
	}

	/**
	 * Save session to the store
	 * @returns {Promise<void>}
	 */
	save() {

		// Check if the session was changed to save it
		if (this.changed) {

			return this.store.set(this.id, this, this.timeout);
		}

		return this.update();
	}

	/**
	 * Add or update an entry of the session
	 * @param {string} key
	 * @param {*} value
	 * @returns {this}
	 */
	set(key, value) {

		// Allow only string keys
		if (typeof key === 'string') {

			// Set changed flag
			this.changed = true;

			return super.set(key, value);
		}

		return this;
	}

	/**
	 * JSON transform method implementation
	 * @returns {*}
	 */
	toJSON() {

		return Session.fromEntries(this.entries());
	}

	/**
	 * Update session expiration time
	 * @returns {Promise<void>}
	 */
	update() {

		// Check for store update method and call it if available
		if (this.store.update) {
			return this.store.update(this.id, this.timeout);
		}

		return Promise.resolve();
	}

	/**
	 * Create a session for the provided connection
	 * @param {Connection} connection
	 * @param {Store} store
	 * @param {string} id
	 * @param {number} timeout
	 * @returns {Promise<Session>}
	 */
	static async for(connection, store, id, timeout) {

		const session = new Session(store, id, timeout);

		// Link the session to the connection
		connection.session = session;

		// Await for session to load
		await session.load();

		return session;
	}

	/**
	 * Transform entries iterator to plain object
	 * @param {*} entries
	 * @returns {*}
	 */
	// TODO: In Node 12+ replace with Object.fromEntries()
	static fromEntries(entries) {

		return Array.from(entries).reduce((result, entry) => {

			// Add entry to the result
			result[entry[0]] = entry[1];

			return result;
		}, {});
	}
}

module.exports = Session;