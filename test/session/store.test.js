'use strict';

const tap = require('tap');

const Store = require('simples/lib/session/store');

tap.test('Memory store', async (test) => {

	const store = new Store();

	await store.set('key', 'value', 1000);

	test.equal(await store.get('key'), 'value');

	await store.update('key', -1);

	test.equal(await store.get('key'), null);

	await store.set('key', 'value', 1000);
	await store.remove('key');
	await store.update('key', 1000);

	test.equal(await store.get('key'), null);
});

tap.test('Store without configuration', async (test) => {

	const store = new Store(null);

	test.equal(Object.keys(store._options).length, 0);

	try {
		await store.set('key', 'value', 1000);
	} catch (error) {
		test.ok(error instanceof Error);
	}
});

tap.test('Store with empty configuration', async (test) => {

	const store = new Store({});

	test.equal(Object.keys(store._options).length, 0);

	try {
		await store.set('key', 'value', 1000);
	} catch (error) {
		test.ok(error instanceof Error);
	}
});

tap.test('Store with invalid configuration', async (test) => {

	const store = new Store({
		get: () => {
			throw Error('Cannot find value');
		},
		set: () => null,
		remove: () => null,
		update: () => null
	});

	test.equal(Object.keys(store._options).length, 4);

	try {
		await store.set('key', 'value', 1000);
	} catch (error) {
		test.ok(error instanceof Error);
	}

	try {
		await store.get('key');
	} catch (error) {
		test.ok(error instanceof Error);
	}
});