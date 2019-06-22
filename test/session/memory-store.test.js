'use strict';

const tap = require('tap');

const MemoryStore = require('simples/lib/session/memory-store');
const Session = require('simples/lib/session/session');

const existentId = 'existentId';
const expiredId = 'expiredId';
const nonExistentId = 'nonExistentId';

tap.test('MemoryStore.get', (test) => {

	const storeContainer = new Map();
	const fakeSession = new Session('', {});
	const expiredSession = new Session('', {});

	expiredSession.expires = Date.now();

	storeContainer.set(existentId, fakeSession);
	storeContainer.set(expiredId, expiredSession);

	const getImplementation = MemoryStore.get(storeContainer);

	test.equal(typeof getImplementation, 'function');

	Promise.all([
		getImplementation(nonExistentId).then((session) => {
			test.equal(session, null);
		}),
		getImplementation(existentId).then((session) => {
			test.equal(session, fakeSession);
		}),
		getImplementation(expiredId).then((session) => {
			test.equal(session, null);
			test.ok(!storeContainer.has(expiredId));
		})
	]).then(() => {
		test.end();
	});
});

tap.test('MemoryStore.set', (test) => {

	const storeContainer = new Map();
	const fakeSession = new Session('', {});

	const setImplementation = MemoryStore.set(storeContainer);

	test.equal(typeof setImplementation, 'function');

	setImplementation(existentId, fakeSession).then(() => {
		test.equal(storeContainer.get(existentId), fakeSession);
	}).then(() => {
		test.end();
	});
});

tap.test('MemoryStore.unset', (test) => {

	const storeContainer = new Map();
	const fakeSession = new Session('', {});

	storeContainer.set(existentId, fakeSession);

	const unsetImplementation = MemoryStore.unset(storeContainer);

	test.equal(typeof unsetImplementation, 'function');

	unsetImplementation(existentId).then(() => {
		test.equal(storeContainer.size, 0);
	}).then(() => {
		test.end();
	});
});

tap.test('MemoryStore.createConfig', (test) => {

	const storeConfig = MemoryStore.createConfig();

	test.match(storeConfig, {
		get: Function,
		set: Function,
		unset: Function
	});

	test.end();
});