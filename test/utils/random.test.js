'use strict';

const tap = require('tap');

const Random = require('simples/lib/utils/random');
const TestUtils = require('simples/test/test-utils');

tap.test('Random.randomBuffer()', (test) => {
	TestUtils.mockBufferAllocUnsafe(() => {

		const result = Random.randomBuffer(4);

		test.ok(Buffer.isBuffer(result));
		test.equal(result.length, 4);

		test.end();
	});
});

tap.test('Random.randomBase64()', (test) => {
	TestUtils.mockBufferAllocUnsafe(() => {

		const result = Random.randomBase64(4);

		test.equal(typeof result, 'string');
		test.equal(Buffer.from(result, 'base64').length, 4);

		test.end();
	});
});

tap.test('Random.randomHex()', (test) => {
	TestUtils.mockBufferAllocUnsafe(() => {

		const result = Random.randomHex(4);

		test.equal(typeof result, 'string');
		test.equal(Buffer.from(result, 'hex').length, 4);

		test.end();
	});
});