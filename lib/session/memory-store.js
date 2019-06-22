'use strict';

const { now } = Date;

class MemoryStore {

	/**
	 * Create a memory session store configuration
	 * @returns {StoreInterface}
	 */
	static createConfig() {

		const container = new Map();

		return {
			get: MemoryStore.get(container),
			set: MemoryStore.set(container),
			unset: MemoryStore.unset(container)
		};
	}

	/**
	 * Create a function to get the session object from the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string) => Promise<Session<*>>}
	 */
	static get(container) {

		return (id) => {

			// Check if session with provided id exists
			if (container.has(id)) {

				const session = container.get(id);

				// Check if the session is expired
				if (session.expires <= now()) {

					// Remove session with the provided id
					container.delete(id);

					return Promise.resolve(null);
				}

				return Promise.resolve(session);
			}

			return Promise.resolve(null);
		};
	}

	/**
	 * Create a function to set the session object in the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string, session: Session<*>) => Promise<void>}
	 */
	static set(container) {

		return (id, session) => {

			// Create container entry for session object
			container.set(id, session);

			return Promise.resolve();
		};
	}

	/**
	 * Create a function to unset the session object from the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string) => Promise<void>}
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