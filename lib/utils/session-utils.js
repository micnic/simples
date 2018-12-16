'use strict';

const crypto = require('crypto');
const ErrorEmitter = require('simples/lib/utils/error-emitter');

class SessionUtils {

	// Set the connection session and handle any errors
	static applySession(connection, session) {

		SessionUtils.setSession(connection, session).catch((error) => {
			ErrorEmitter.emit(connection._router, error);
		});
	}

	// Generate a new session container
	static generateSession(router) {

		const hash = crypto.Hash('sha1');
		const sessionHashLength = 32; // Length of session hash buffer
		const sessionIdLength = 16; // Length of session id buffer

		return new Promise((resolve, reject) => {

			// Generate random session id
			crypto.randomBytes(sessionHashLength, (error, id) => {
				if (error) {
					reject(error);
				} else {
					resolve({
						container: {},
						hash: hash.update(id).digest('hex'),
						id: id.slice(sessionIdLength).toString('hex'),
						timeout: router._options.session.timeout
					});
				}
			});
		});
	}

	// Get an existing stored session or generate a new one
	static getSession(connection) {

		const cookies = connection.cookies;
		const id = cookies._session;
		const router = connection._router;

		// Validate session cookies and get the session container
		if (id) {

			const hash = cookies._hash;
			const options = router._options.session;

			return options.store.get(id).then((session) => {
				if (session && session.hash === hash) {
					return session;
				} else {
					return SessionUtils.generateSession(router);
				}
			});
		} else {
			return SessionUtils.generateSession(router);
		}
	}

	// Generate a new session container and write
	static regenerateSession(store, connection) {

		const router = connection._router;

		return SessionUtils.generateSession(router).then((session) => {
			return SessionUtils.storeSession(store, connection, session);
		});
	}

	// Set the session in the store, reset or regenerate and store it
	static setSession(connection, session) {

		const router = connection._router;
		const options = router._options.session;
		const store = options.store;

		// Check if the connection session reference was modified
		if (connection.session === session.container) {

			// Update session expiration time based on the provided options
			SessionUtils.updateSession(session, options.timeout);

			// Save the session to the store
			return SessionUtils.storeSession(store, connection, session);
		} else if (connection.session === null) {
			return store.unset(session.id);
		} else {
			return store.unset(session.id).then(() => {
				return SessionUtils.regenerateSession(store, connection);
			});
		}
	}

	// Set the session in the store, then remove its reference
	static storeSession(store, connection, session) {

		return store.set(session.id, session).then(() => {
			connection.session = null;
		});
	}

	// Update session expiration time
	static updateSession(session, timeout) {

		const second = 1000; // Milliseconds in one second

		// Update session expiration time
		session.expire = Date.now() + (timeout * second);
	}
}

module.exports = SessionUtils;