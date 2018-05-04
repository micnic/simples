'use strict';

const tap = require('tap');

const ConcatStream = require('simples/lib/parsers/concat-stream');
const QsParser = require('simples/lib/parsers/qs-parser');
const symbols = require('simples/lib/utils/symbols');

const { Transform } = require('stream');

tap.test('QsParser.addData(emptyResult, key, value, notArrayFormat)', (test) => {

	const result = {};

	QsParser.addData(result, 'key', 'value', false);

	test.match(result, {
		key: 'value'
	});

	test.end();
});

tap.test('QsParser.addData(emptyResult, key, value, arrayFormat)', (test) => {

	const result = {};

	QsParser.addData(result, 'key', 'value', true);

	test.match(result, {
		key: [
			'value'
		]
	});

	test.end();
});

tap.test('QsParser.addData(resultWithThisKey, key, value, notArrayFormat)', (test) => {

	const result = {
		key: 'value'
	};

	QsParser.addData(result, 'key', 'value', false);

	test.match(result, {
		key: [
			'value',
			'value'
		]
	});

	test.end();
});

tap.test('QsParser.addData(resultWithThisKeyInArray, key, value, notArrayFormat)', (test) => {

	const result = {
		key: [
			'value'
		]
	};

	QsParser.addData(result, 'key', 'value', false);

	test.match(result, {
		key: [
			'value',
			'value'
		]
	});

	test.end();
});

tap.test('QsParser.create()', (test) => {

	const parser = QsParser.create();

	test.ok(parser instanceof QsParser);
	test.ok(parser instanceof ConcatStream);
	test.ok(parser instanceof Transform);

	test.end();
});

tap.test('QsParser.parse', (test) => {

	let result = QsParser.parse('key=value');

	test.match(result, {
		key: 'value'
	});

	// --------------------

	result = QsParser.parse();

	test.match(result, {});

	// --------------------

	result = QsParser.parse(null);

	test.match(result, {});

	test.end();
});

tap.test('QsParser.parseChar', (test) => {

	let result = {};

	let state = {
		expect: symbols.expectValue,
		key: 'key',
		value: 'value'
	};

	QsParser.parseChar('&', result, state);

	test.match(result, {
		key: 'value'
	});
	test.match(state, {
		expect: symbols.expectKey,
		key: '',
		value: ''
	});

	// --------------------

	result = {};

	state = {
		expect: symbols.expectValue,
		key: 'key',
		value: 'valu'
	};

	QsParser.parseChar('e', result, state);

	test.match(result, {});
	test.match(state, {
		expect: symbols.expectValue,
		key: 'key',
		value: 'value'
	});

	// --------------------

	result = {};

	state = {
		expect: symbols.expectKey,
		key: '',
		value: ''
	};

	QsParser.parseChar('=', result, state);

	test.match(result, {});
	test.match(state, {
		expect: symbols.expectValue,
		key: '',
		value: ''
	});

	// --------------------

	result = {};

	state = {
		expect: symbols.expectKey,
		key: 'ke',
		value: ''
	};

	QsParser.parseChar('y', result, state);

	test.match(result, {});
	test.match(state, {
		expect: symbols.expectKey,
		key: 'key',
		value: ''
	});

	test.end();
});

tap.test('QsParser.prepareResult', (test) => {

	let result = {};

	QsParser.prepareResult(result, '', '');

	test.match(result, {});

	// --------------------

	result = {};

	QsParser.prepareResult(result, '[]', '');

	test.match(result, {});

	// --------------------

	result = {};

	QsParser.prepareResult(result, 'key', 'value');

	test.match(result, {
		key: 'value'
	});

	// --------------------

	result = {};

	QsParser.prepareResult(result, 'key[]', 'value');

	test.match(result, {
		key: [
			'value'
		]
	});

	test.end();
});

tap.test('QsParser#pushResult', (test) => {

	const parser = QsParser.create();

	parser.on('data', (data) => {
		test.match(data, {});
	});

	parser.pushResult((error) => {
		test.ok(error === null);
		test.ok(parser.buffer === '');
	});

	test.end();
});