'use strict';

const tap = require('tap');

const QSParser = require('simples/lib/parsers/qs-parser');

tap.test('QSParser.addEntry()', (test) => {

	const result = Object.create(null);

	test.test('Empty key', (t) => {

		QSParser.addEntry(result, '', '', 0);

		t.equal(Object.keys(result).length, 0);

		t.end();
	});

	test.test('First key', (t) => {

		QSParser.addEntry(result, 'a', 'a', 0);

		t.equal(result['a'], 'a');

		t.end();
	});

	test.test('Key with array notation', (t) => {

		QSParser.addEntry(result, 'b[]', 'b', 0);

		t.match(result['b'], ['b']);

		t.end();
	});

	test.test('Existing array key', (t) => {

		QSParser.addEntry(result, 'b', 'b', 0);

		t.match(result['b'], ['b', 'b']);

		t.end();
	});

	test.test('Existing string key', (t) => {

		QSParser.addEntry(result, 'a', 'a', 0);

		t.match(result['a'], ['a', 'a']);

		t.end();
	});

	test.test('Escaped value', (t) => {

		QSParser.addEntry(result, 'c', '%63', 1);

		t.match(result['c'], 'c');

		t.end();
	});

	test.test('Escaped key', (t) => {

		QSParser.addEntry(result, '%64', 'd', 2);

		t.match(result['d'], 'd');

		t.end();
	});

	test.test('Escaped key and value', (t) => {

		QSParser.addEntry(result, '%65', '%65', 3);

		t.match(result['e'], 'e');

		t.end();
	});

	test.end();
});

tap.test('QSParser.parse()', (test) => {

	test.test('Parse null', (t) => {

		t.match(QSParser.parse(null), {});

		t.end();
	});

	test.test('Parse empty string', (t) => {

		t.match(QSParser.parse(''), {});

		t.end();
	});

	test.test('Parse string that covers all cases', (t) => {

		t.match(QSParser.parse('a+%61=a+%61&'), {});

		t.end();
	});

	test.end();
});