'use strict';

const crypto = require('crypto');
const ErrorEmitter = require('simples/lib/utils/error-emitter');

const {
	second,
	sessionHashLength,
	sessionIdLength
} = require('simples/lib/utils/constants');

class SessionUtils {

	// Generate session id and hash
	static generateSession(host, callback) {

		// Generate random session id
		crypto.randomBytes(sessionHashLength, (error, sessionId) => {
			if (error) {
				ErrorEmitter.emit(host, error);
			} else {
				callback({
					container: {},
					hash: crypto.Hash('sha1').update(sessionId).digest('hex'),
					id: sessionId.slice(sessionIdLength).toString('hex'),
					timeout: host._options.session.timeout
				});
			}
		});
	}

	// Get an existing stored session or generate a new one
	static getSession(host, connection, callback) {

		const cookies = connection.cookies;

		// Validate session cookies and get the session container
		if (cookies._session) {

			const sessionOptions = host._options.session;

			// Extract session data from the store
			sessionOptions.store.get(cookies._session).then((session) => {
				if (session && session.hash === cookies._hash) {
					callback(session);
				} else {
					SessionUtils.generateSession(host, callback);
				}
			}).catch((error) => {
				ErrorEmitter.emit(host, error);
			});
		} else {
			SessionUtils.generateSession(host, callback);
		}
	}

	// Write the session to the host storage
	static setSession(host, connection, session) {

		const sessionOptions = host._options.session;
		const store = sessionOptions.store;
		const timeout = sessionOptions.timeout * second;

		if (connection.session === session.container) {

			// Update session expiration time
			session.expire = Date.now() + timeout;

			// Save the session to the store
			store.set(session.id, session).then(() => {
				connection.session = null;
			}).catch((error) => {
				ErrorEmitter.emit(host, error);
			});
		} else if (connection.session === null) {
			store.unset(session.id).catch((error) => {
				ErrorEmitter.emit(host, error);
			});
		} else if (typeof connection.session === 'object') {
			store.unset(session.id).then(() => {
				SessionUtils.generateSession(host, (newSession) => {
					store.set(newSession.id, newSession, (error) => {
						if (error) {
							ErrorEmitter.emit(host, error);
						} else {
							connection.session = null;
						}
					});
				});
			}).catch((error) => {
				ErrorEmitter.emit(host, error);
			});
		}
	}
}

module.exports = SessionUtils;