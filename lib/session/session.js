'use strict';

const crypto = require('crypto');

const { now } = Date;
const { keys } = Object;

const sessionIdLength = 16; // Length of session id buffer

class Session extends Map {

	/**
	 * Session constructor
	 * @param {string} id
	 * @param {{store: Store, timeout: number}} options
	 */
	constructor(id = '', options) {

		super();

		// Define session public properties
		this.changed = false;
		this.expires = now() + options.timeout;
		this.id = id;
		this.store = options.store;
		this.timeout = options.timeout;
	}

	/**
	 * Remove all session entries
	 */
	clear() {
		super.clear();
		this.changed = true;
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
		return this.store.unset(this.id);
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
	 * Load the session from the store
	 * @returns {Promise<void>}
	 */
	load() {

		// Check for session id to get session from the store
		if (this.id) {

			return this.store.get(this.id).then((data) => {

				// Check if there is available session data in the store
				if (data) {

					const session = JSON.parse(data);

					// Clear all session data and update expiration time
					this.clear();
					this.update();

					// Populate session entries
					keys(session.entries).forEach((key) => {
						this.set(key, session.entries[key]);
					});

					// Set changed flag
					this.changed = false;

					return undefined;
				}

				return this.generate();
			});
		}

		return this.generate();
	}

	/**
	 * Save session to the store
	 * @returns {Promise<void>}
	 */
	save() {

		// Update expiration time
		this.update();

		return this.store.set(this.id, JSON.stringify(this));
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
	 */
	toJSON() {

		return {
			entries: Session.fromEntries(this.entries()),
			expires: this.expires,
			id: this.id,
			timeout: this.timeout
		};
	}

	/**
	 * Update session expiration time
	 */
	update() {
		this.expires = now() + this.timeout;
	}

	/**
	 * Create a session for the provided connection
	 * @param {Connection} connection
	 */
	static for(connection) {

		const options = connection._router._options.session;
		const session = new Session(connection.cookies._session, options);

		// Link the session to the connection
		connection.session = session;

		return session.load().then(() => session);
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