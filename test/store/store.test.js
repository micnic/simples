'use strict';

const tap = require('tap');

const MemoryStore = require('simples/lib/store/memory-store');
const Store = require('simples/lib/store/store');

const notImplemented = 'Not Implemented';
const sessionId = 'sessionId';

const fakeSession = {};

const someError = Error('Some error');

tap.test('Store.optionsContainer()', (test) => {

	test.test('Empty config', (t) => {
		t.match(Store.optionsContainer({}), {});
		t.end();
	});

	test.test('Full config', (t) => {

		const fakeGetMethodImplementation = () => {};
		const fakeSetMethodImplementation = () => {};
		const fakeUnsetMethodImplementation = () => {};

		t.match(Store.optionsContainer({
			get: fakeGetMethodImplementation,
			set: fakeSetMethodImplementation,
			unset: fakeUnsetMethodImplementation
		}), {
			get: fakeGetMethodImplementation,
			set: fakeSetMethodImplementation,
			unset: fakeUnsetMethodImplementation
		});
		t.end();
	});

	test.end();
});

tap.test('Store.prototype.constructor()', (test) => {

	const emptyConfig = {};

	test.test('Memory store', (t) => {

		const memoryStore = new Store();

		t.ok(memoryStore instanceof Store);
		t.end();
	});

	test.test('Empty store', (t) => {

		const emptyStore = new Store(emptyConfig);

		t.ok(emptyStore instanceof Store);
		t.match(emptyStore._options, emptyConfig);
		t.end();
	});

	test.end();
});

tap.test('Store.prototype.get()', (test) => {

	test.test('Not implemented', (t) => {
		new Store({}).get(sessionId).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.ok(error instanceof Error);
			t.equal(error.message, notImplemented);
			t.end();
		});
	});

	test.test('Implemented, normal execution', (t) => {
		new Store({
			get(id) {
				t.equal(id, sessionId);

				return Promise.resolve(fakeSession);
			}
		}).get(sessionId).then((session) => {
			t.equal(session, fakeSession);
			t.end();
		}).catch(() => {
			t.fail('Error should not be called');
		});
	});

	test.test('Implemented, throws error', (t) => {
		new Store({
			get(id) {
				t.equal(id, sessionId);

				throw someError;
			}
		}).get(sessionId).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.test('Implemented, rejects with error', (t) => {
		new Store({
			get(id) {
				t.equal(id, sessionId);

				return Promise.reject(someError);
			}
		}).get(sessionId).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.end();
});

tap.test('Store.prototype.set()', (test) => {

	test.test('Not implemented', (t) => {
		new Store({}).set(sessionId, fakeSession).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.ok(error instanceof Error);
			t.equal(error.message, notImplemented);
			t.end();
		});
	});

	test.test('Implemented', (t) => {
		new Store({
			set(id, session) {
				t.equal(id, sessionId);
				t.equal(session, fakeSession);

				return Promise.resolve();
			}
		}).set(sessionId, fakeSession).then(() => {
			t.end();
		}).catch(() => {
			t.fail('Error should not be called');
		});
	});

	test.test('Implemented, throws error', (t) => {
		new Store({
			set(id, session) {
				t.equal(id, sessionId);
				t.equal(session, fakeSession);

				throw someError;
			}
		}).set(sessionId, fakeSession).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.test('Implemented, rejects with error', (t) => {
		new Store({
			set(id, session) {
				t.equal(id, sessionId);
				t.equal(session, fakeSession);

				return Promise.reject(someError);
			}
		}).set(sessionId, fakeSession).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.end();
});

tap.test('Store.prototype.unset()', (test) => {

	test.test('Not implemented', (t) => {
		new Store({}).unset(sessionId).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.ok(error instanceof Error);
			t.equal(error.message, notImplemented);
			t.end();
		});
	});

	test.test('Implemented', (t) => {
		new Store({
			unset(id) {
				t.equal(id, sessionId);

				return Promise.resolve();
			}
		}).unset(sessionId).then(() => {
			t.end();
		}).catch(() => {
			t.fail('Error should not be called');
		});
	});

	test.test('Implemented, throws error', (t) => {
		new Store({
			unset(id) {
				t.equal(id, sessionId);

				throw someError;
			}
		}).unset(sessionId).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.test('Implemented, rejects with error', (t) => {
		new Store({
			unset(id) {
				t.equal(id, sessionId);

				return Promise.reject(someError);
			}
		}).unset(sessionId).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.end();
});