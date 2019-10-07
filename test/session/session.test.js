'use strict';

const tap = require('tap');

const Session = require('simples/lib/session/session');
const Store = require('simples/lib/session/store');
const TestUtils = require('simples/test/test-utils');

tap.test('Session.prototype.constructor()', (test) => {

	let session = new Session(new Store(), '', 1);

	test.ok(session instanceof Map);
	test.equal(session.changed, false);
	test.equal(session.id, '');
	test.ok(session.store instanceof Store);
	test.equal(session.timeout, 1);

	session = new Session(new Store(), undefined, 1);

	test.ok(session instanceof Map);
	test.equal(session.changed, false);
	test.equal(session.id, '');
	test.ok(session.store instanceof Store);
	test.equal(session.timeout, 1);

	test.end();
});

tap.test('Session.prototype.clear()', (test) => {

	const session = new Session(new Store(), 'id', 1);

	session.set('key', 'value');

	session.clear();
	test.equal(session.changed, true);
	test.equal(session.size, 0);

	test.end();
});

tap.test('Session.prototype.delete()', (test) => {

	const session = new Session(new Store(), 'id', 1);

	session.set('key', 'value');
	session.changed = false;

	test.ok(!session.delete('inexistent-key'));
	test.equal(session.changed, false);
	test.equal(session.size, 1);

	test.ok(session.delete('key'));
	test.equal(session.changed, true);
	test.equal(session.size, 0);

	test.end();
});

tap.test('Session.prototype.destroy()', (test) => {

	const store = new Store({
		remove(id) {

			test.equal(id, 'id');

			return Promise.resolve();
		}
	});

	const session = new Session(store, 'id', 1);

	session.destroy().then(() => {
		test.end();
	});
});

tap.test('Session.prototype.generate()', (test) => {

	test.test('Normal generation', (t) => {
		TestUtils.mockCryptoRandomBytes(null, Buffer.from([255]), () => {
			const session = new Session(new Store(), 'id', 1);

			session.generate().then(() => {
				t.equal(session.id, 'ff');
				t.end();
			});
		});
	});

	test.test('Generation with error', (t) => {

		const someError = Error('Some error');

		TestUtils.mockCryptoRandomBytes(someError, null, () => {
			const session = new Session(new Store(), 'id', 1);

			session.generate().then(() => {
				t.fail('The promise should not be resolved');
			}).catch((error) => {
				t.equal(error, someError);
				t.end();
			});
		});
	});

	test.end();
});

tap.test('Session.prototype.load()', (test) => {

	test.test('No id', (t) => {
		TestUtils.mockCryptoRandomBytes(null, Buffer.from([255]), () => {
			const session = new Session(new Store(), '', 1);

			session.load().then(() => {
				t.equal(session.id, 'ff');
				t.end();
			});
		});
	});

	test.test('Non-existent id', (t) => {
		TestUtils.mockCryptoRandomBytes(null, Buffer.from([255]), (restore) => {
			const session = new Session(new Store(), 'non-existent', 1);

			session.load().then(() => {
				t.equal(session.id, 'ff');
				restore();
				t.end();
			});
		});
	});

	test.test('Existent id', (t) => {

		const store = new Store({
			get(id) {

				t.equal(id, 'existent-id');

				return Promise.resolve({
					key: 'value'
				});
			}
		});

		const session = new Session(store, 'existent-id', 1);

		session.load().then(() => {
			t.equal(session.size, 1);
			t.equal(session.get('key'), 'value');
			t.equal(session.id, 'existent-id');
			t.equal(session.timeout, 1);
			t.end();
		});
	});

	test.end();
});

tap.test('Session.prototype.save()', (test) => {

	const store = new Store({
		set(id, s, timeout) {

			test.equal(id, 'id');
			test.equal(s, session);
			test.equal(timeout, 1);

			return Promise.resolve();
		},
		update(id, timeout) {
			test.equal(id, 'id');
			test.equal(timeout, 1);

			return Promise.resolve();
		}
	});

	const session = new Session(store, 'id', 1);

	session.save().then(() => {

		session.set('data', 'data');

		return session.save();
	}).then(() => {
		test.end();
	}).catch(() => {
		test.fail('Promise should not reject');
	});
});

tap.test('Session.prototype.set()', (test) => {

	const session = new Session(new Store(), 'id', 1);

	test.equal(session.set(null, null), session);
	test.equal(session.changed, false);
	test.equal(session.size, 0);

	test.equal(session.set('key', 'value'), session);
	test.equal(session.changed, true);
	test.equal(session.size, 1);

	test.end();
});

tap.test('Session.prototype.toJSON()', (test) => {

	const session = new Session(new Store(), 'id', 1);

	test.match(session.toJSON(), {});

	test.end();
});

tap.test('Session.prototype.update()', (test) => {

	const session = new Session({}, 'id', 1);

	session.update().then(() => {
		test.end();
	}).catch(() => {
		test.fail('Promise should not reject');
	});
});

tap.test('Session.for()', (test) => {

	const store = new Store({
		get() {

			return Promise.resolve({
				key: 'value'
			});
		}
	});

	const connection = {
		cookies: {
			_session: 'id'
		},
		_router: {
			_options: {
				session: {
					store,
					timeout: 1
				}
			}
		}
	};

	Session.for(connection, store, connection.cookies._session, connection._router._options.session.timeout).then((session) => {

		test.equal(connection.session, session);
		test.equal(session.size, 1);
		test.equal(session.get('key'), 'value');
		test.equal(session.id, 'id');
		test.equal(session.timeout, 1);

		test.end();
	});
});

tap.test('Session.fromEntries()', (test) => {

	const map = new Map([['key', 'value']]);

	test.match(Session.fromEntries(map.entries()), {
		key: 'value'
	});

	test.end();
});