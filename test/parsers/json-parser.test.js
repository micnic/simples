'use strict';

const tap = require('tap');

const ConcatStream = require('simples/lib/parsers/concat-stream');
const JsonParser = require('simples/lib/parsers/json-parser');

tap.test('JsonParser.prototype.constructor()', (test) => {

	const parser = new JsonParser();

	test.ok(parser instanceof JsonParser);
	test.ok(parser instanceof ConcatStream);

	test.end();
});

tap.test('JsonParser.prototype.pushResult()', (test) => {

	test.test('With empty buffer', (t) => {

		const parser = new JsonParser();

		parser.pushResult((error) => {
			t.ok(error instanceof Error);
			t.ok(parser.buffer === '');
		});

		t.end();
	});

	test.test('With json data buffer', (t) => {

		const parser = new JsonParser();

		parser.buffer = '{}';

		parser.on('data', (data) => {
			t.match(data, {});
		});

		parser.pushResult((error) => {
			t.ok(error === null);
		});

		t.end();
	});

	test.end();
});