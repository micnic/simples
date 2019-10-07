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
			remove: MemoryStore.remove(container),
			set: MemoryStore.set(container),
			update: MemoryStore.update(container)
		};
	}

	/**
	 * Create a function to get the session from the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string) => Promise<Session<*>>}
	 */
	static get(container) {

		return (id) => {

			// Check if session with the provided id exists
			if (container.has(id)) {

				const [expires, session] = container.get(id);

				// Check if the session is expired
				if (expires <= now()) {

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
	 * Create a function to remove the session from the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string) => Promise<void>}
	 */
	static remove(container) {

		return (id) => {

			// Delete session
			container.delete(id);

			return Promise.resolve();
		};
	}

	/**
	 * Create a function to set the session in the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string, session: Session<*>) => Promise<void>}
	 */
	static set(container) {

		return (id, session, timeout) => {

			// Create container entry for session
			container.set(id, [now() + timeout, session]);

			return Promise.resolve();
		};
	}

	/**
	 * Create a function to update session` from the provided container
	 * @param {Map<string, Session<*>>} container
	 * @returns {(id: string, timeout: number) => Promise<void>}
	 */
	static update(container) {

		return (id, timeout) => {

			const data = container.get(id);

			// Check for existing session data
			if (data) {

				// Set the new expiration time
				container.set(id, [now() + timeout, data[1]]);
			}

			return Promise.resolve();
		};
	}
}

module.exports = MemoryStore;