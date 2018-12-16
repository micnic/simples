'use strict';

class MemoryStore {

	/**
	 * Clear the provided session container by deleting expired sessions
	 * @param {Map<string, SessionContainer<*>>} container
	 */
	static clear(container) {

		const now = Date.now();

		// Loop through the session objects and delete expired elements
		container.forEach((value, id) => {
			if (value.expire <= now) {
				container.delete(id);
			}
		});
	}

	/**
	 * Create a memory session store configuration
	 * @param {number} timeout
	 * @returns {StoreInterface}
	 */
	static createConfig(timeout) {

		const container = new Map();

		// Clear the expired stored sessions at the defined interval
		setInterval(MemoryStore.clear, timeout, container).unref();

		return {
			get: MemoryStore.get(container),
			set: MemoryStore.set(container),
			unset: MemoryStore.unset(container)
		};
	}

	/**
	 * Create a function to get the session object from the provided container
	 * @param {Map<string, SessionContainer<*>>} container
	 * @returns {Function}
	 */
	static get(container) {

		return (id) => {

			let session = null;

			// Get session object
			if (container.has(id)) {
				session = container.get(id).session;
			}

			return Promise.resolve(session);
		};
	}

	/**
	 * Create a function to set the session object in the provided container
	 * @param {Map<string, SessionContainer<*>>} container
	 * @returns {Function}
	 */
	static set(container) {

		return (id, session) => {

			// Create container entry for session object
			container.set(id, {
				expire: Date.now() + session.timeout,
				session
			});

			return Promise.resolve();
		};
	}

	/**
	 * Create a function to unset the session object from the provided container
	 * @param {Map<string, SessionContainer<*>>} container
	 * @returns {Function}
	 */
	static unset(container) {

		return (id) => {

			// Delete session object
			container.delete(id);

			return Promise.resolve();
		};
	}
}

module.exports = MemoryStore;