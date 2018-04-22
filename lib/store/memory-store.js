'use strict';

class MemoryStore {

	// Clear the provided session container by deleting expired sessions
	static clear(container) {

		const now = Date.now();

		// Loop through the session objects and delete expired elements
		container.forEach((value, id) => {
			if (value.expire <= now) {
				container.delete(id);
			}
		});
	}

	// Create a memory session store configuration
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

	// Create a function to get the session object from the provided container
	static get(container) {

		return (id, callback) => {

			let session = null;

			// Get session object
			if (container.has(id)) {
				session = container.get(id).session;
			}

			// Call the provided callback with the session object
			callback(null, session);
		};
	}

	// Create a function to set the session object in the provided container
	static set(container) {

		return (id, session, callback) => {

			// Create container entry for session object
			container.set(id, {
				expire: Date.now() + session.timeout,
				session
			});

			// Call the provided callback
			callback(null);
		};
	}

	// Create a function to unset the session object from the provided container
	static unset(container) {

		return (id, callback) => {
			container.delete(id);
			callback(null);
		};
	}
}

module.exports = MemoryStore;