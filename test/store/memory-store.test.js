'use strict';

const sinon = require('sinon');
const tap = require('tap');

const MemoryStore = require('simples/lib/store/memory-store');

const existentId = 'existentId';
const expiredId = 'expiredId';
const nonExistentId = 'nonExistentId';
const nonExpiredId = 'nonExpiredId';
const second = 1000;

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

	test.ok(storeContainer.get(expiredId) === undefined);
	test.ok(storeContainer.get(nonExpiredId) === validSessionContainer);

	test.end();
});

tap.test('MemoryStore.get', (test) => {

	const storeContainer = new Map();
	const fakeSession = {};
	const fakeSessionContainer = {};

	fakeSessionContainer.session = fakeSession;
	storeContainer.set(existentId, fakeSessionContainer);

	const getImplementation = MemoryStore.get(storeContainer);

	test.ok(typeof getImplementation === 'function');

	getImplementation(nonExistentId, (error, session) => {
		test.ok(error === null);
		test.ok(session === null);
	});

	getImplementation(existentId, (error, session) => {
		test.ok(error === null);
		test.ok(session === fakeSession);
	});

	test.end();
});

tap.test('MemoryStore.set', (test) => {

	const storeContainer = new Map();
	const fakeSession = {};

	const setImplementation = MemoryStore.set(storeContainer);

	test.ok(typeof setImplementation === 'function');

	setImplementation(existentId, fakeSession, (error) => {
		test.ok(error === null);
	});

	test.ok(typeof storeContainer.get(existentId) === 'object');
	test.ok(typeof storeContainer.get(existentId).expire === 'number');
	test.ok(storeContainer.get(existentId).session === fakeSession);

	test.end();
});

tap.test('MemoryStore.unset', (test) => {

	const storeContainer = new Map();
	const fakeSession = {};
	const fakeSessionContainer = {};

	fakeSessionContainer.session = fakeSession;
	storeContainer[existentId] = fakeSessionContainer;

	const unsetImplementation = MemoryStore.unset(storeContainer);

	test.ok(typeof unsetImplementation === 'function');

	unsetImplementation(existentId, (error) => {
		test.ok(error === null);
	});

	test.ok(storeContainer.get(existentId) === undefined);

	test.end();
});

tap.test('MemoryStore.createConfig', (test) => {

	const fakeGetImplementation = () => null;
	const fakeSetImplementation = () => null;
	const fakeUnsetImplementation = () => null;

	sinon.stub(MemoryStore, 'clear');
	sinon.stub(MemoryStore, 'get').returns(fakeGetImplementation);
	sinon.stub(MemoryStore, 'set').returns(fakeSetImplementation);
	sinon.stub(MemoryStore, 'unset').returns(fakeUnsetImplementation);

	const clock = sinon.useFakeTimers();
	const storeConfig = MemoryStore.createConfig(second);

	clock.next();
	clock.restore();

	test.match(storeConfig, {
		get: fakeGetImplementation,
		set: fakeSetImplementation,
		unset: fakeUnsetImplementation
	});

	test.ok(MemoryStore.clear.withArgs(sinon.match({})).calledOnce);
	test.ok(MemoryStore.get.withArgs(sinon.match({})).calledOnce);
	test.ok(MemoryStore.set.withArgs(sinon.match({})).calledOnce);
	test.ok(MemoryStore.unset.withArgs(sinon.match({})).calledOnce);

	MemoryStore.clear.restore();
	MemoryStore.get.restore();
	MemoryStore.set.restore();
	MemoryStore.unset.restore();

	test.end();
});