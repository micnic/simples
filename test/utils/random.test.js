'use strict';

const tap = require('tap');

const Random = require('simples/lib/utils/random');

tap.test('Random.randomBuffer', (test) => {

	const result = Random.randomBuffer(4);

	test.ok(Buffer.isBuffer(result));
	test.ok(result.length === 4);

	test.end();
});

tap.test('Random.randomBase64', (test) => {

	const result = Random.randomBase64(4);

	test.ok(typeof result === 'string');

	test.end();
});