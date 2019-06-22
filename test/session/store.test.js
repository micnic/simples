'use strict';

const tap = require('tap');

const Session = require('simples/lib/session/session');
const Store = require('simples/lib/session/store');

const notImplemented = 'Not implemented';
const noPromiseResult = 'No promise result';
const sessionId = 'sessionId';

const fakeSession = new Session('', {});

const someError = Error('Some error');

tap.test('Store.prototype.constructor()', (test) => {

	test.test('Memory store', (t) => {

		const memoryStore = new Store();

		t.match(memoryStore._options, {
			get: Function,
			set: Function,
			unset: Function
		});
		t.end();
	});

	test.test('Empty store', (t) => {

		const emptyStore = new Store({});

		t.match(emptyStore._options, {});
		t.end();
	});

	test.end();
});

tap.test('Store.optionsContainer()', (test) => {

	test.test('No config', (t) => {
		t.match(Store.optionsContainer(), {});
		t.end();
	});

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

tap.test('Store.tryImplementation()', (test) => {

	test.test('Not implemented', (t) => {
		Store.tryImplementation(undefined).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.ok(error instanceof Error);
			t.equal(error.message, notImplemented);
			t.end();
		});
	});

	test.test('Implemented, throws error', (t) => {
		Store.tryImplementation(() => {
			throw someError;
		}).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error, someError);
			t.end();
		});
	});

	test.test('Implemented, no promise result', (t) => {
		Store.tryImplementation(() => null).then(() => {
			t.fail('This function should not be called');
		}).catch((error) => {
			t.equal(error.message, noPromiseResult);
			t.end();
		});
	});

	test.test('Implemented, normal execution', (t) => {
		Store.tryImplementation((id) => {

			t.equal(id, 'id');

			return Promise.resolve(id);
		}, 'id').then((result) => {
			t.equal(result, 'id');
			t.end();
		}).catch(() => {
			t.fail('Error should not be called');
		});
	});

	test.end();
});

tap.test('Store.prototype.get()', (test) => {
	new Store({
		get(id) {
			test.equal(id, sessionId);

			return Promise.resolve(fakeSession);
		}
	}).get(sessionId).then((session) => {
		test.equal(session, fakeSession);
		test.end();
	}).catch(() => {
		test.fail('Error should not be called');
	});
});

tap.test('Store.prototype.set()', (test) => {
	new Store({
		set(id, session) {
			test.equal(id, sessionId);
			test.equal(session, fakeSession);

			return Promise.resolve();
		}
	}).set(sessionId, fakeSession).then(() => {
		test.end();
	}).catch(() => {
		test.fail('Error should not be called');
	});
});

tap.test('Store.prototype.unset()', (test) => {
	new Store({
		unset(id) {
			test.equal(id, sessionId);

			return Promise.resolve();
		}
	}).unset(sessionId).then(() => {
		test.end();
	}).catch(() => {
		test.fail('Error should not be called');
	});
});