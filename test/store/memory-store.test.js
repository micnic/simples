'use strict';

const tap = require('tap');
const TestUtils = require('simples/test/test-utils');

const MemoryStore = require('simples/lib/store/memory-store');

const existentId = 'existentId';
const expiredId = 'expiredId';
const nonExistentId = 'nonExistentId';
const nonExpiredId = 'nonExpiredId';
const second = 1000;

TestUtils.mockSetInterval();

tap.test('MemoryStore.clear', (test) => {

	const storeContainer = new Map();
	const expiredSessionContainer = {};
	const validSessionContainer = {};
	const now = Date.now();

	expiredSessionContainer.expire = now - second;
	validSessionContainer.expire = now + second;
	storeContainer.set(expiredId, expiredSessionContainer);
	storeContainer.set(nonExpiredId, validSessionContainer);

	MemoryStore.clear(storeContainer);

	test.equal(storeContainer.get(expiredId), undefined);
	test.equal(storeContainer.get(nonExpiredId), validSessionContainer);

	test.end();
});

tap.test('MemoryStore.get', (test) => {

	const storeContainer = new Map();
	const fakeSession = {};
	const fakeSessionContainer = {};

	fakeSessionContainer.session = fakeSession;
	storeContainer.set(existentId, fakeSessionContainer);

	const getImplementation = MemoryStore.get(storeContainer);

	test.equal(typeof getImplementation, 'function');

	Promise.all([
		getImplementation(nonExistentId).then((session) => {
			test.equal(session, null);
		}),
		getImplementation(existentId).then((session) => {
			test.equal(session, fakeSession);
		})
	]).then(() => {
		test.end();
	});
});

tap.test('MemoryStore.set', (test) => {

	const storeContainer = new Map();
	const fakeSession = {};

	const setImplementation = MemoryStore.set(storeContainer);

	test.equal(typeof setImplementation, 'function');

	setImplementation(existentId, fakeSession).then(() => {
		test.equal(typeof storeContainer.get(existentId), 'object');
		test.equal(typeof storeContainer.get(existentId).expire, 'number');
		test.equal(storeContainer.get(existentId).session, fakeSession);
	}).then(() => {
		test.end();
	});
});

tap.test('MemoryStore.unset', (test) => {

	const storeContainer = new Map();
	const fakeSession = {};
	const fakeSessionContainer = {};

	fakeSessionContainer.session = fakeSession;
	storeContainer[existentId] = fakeSessionContainer;

	const unsetImplementation = MemoryStore.unset(storeContainer);

	test.equal(typeof unsetImplementation, 'function');

	unsetImplementation(existentId).then(() => {
		test.equal(storeContainer.get(existentId), undefined);
	}).then(() => {
		test.end();
	});
});

tap.test('MemoryStore.createConfig', (test) => {

	const storeConfig = MemoryStore.createConfig(second);

	test.match(storeConfig, {
		get: Function,
		set: Function,
		unset: Function
	});

	test.end();
});