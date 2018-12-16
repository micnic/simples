'use strict';

const tap = require('tap');

const QValueParser = require('simples/lib/parsers/q-value-parser');

const langString = 'ro,en;q=0.8';

tap.test('QValueParser.getValueEndIndex()', (test) => {

	let expectedIndex = langString.indexOf(',');

	let index = 0;

	test.test('First index', (t) => {

		const result = QValueParser.getValueEndIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex;

	test.test('Expected index', (t) => {

		const result = QValueParser.getValueEndIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	expectedIndex = langString.indexOf(';');
	index++;

	test.test('Greater index', (t) => {

		const result = QValueParser.getValueEndIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex + 1;

	test.test('Next greater index', (t) => {

		const result = QValueParser.getValueEndIndex(langString, index);

		t.ok(result === langString.length);

		t.end();
	});

	test.end();
});

tap.test('QValueParser.getNextDelimiterIndex()', (test) => {

	const expectedIndex = langString.indexOf(',');

	let index = 0;

	test.test('First index', (t) => {

		const result = QValueParser.getNextDelimiterIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex;

	test.test('Expected index', (t) => {

		const result = QValueParser.getNextDelimiterIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index++;

	test.test('Greater index', (t) => {

		const result = QValueParser.getNextDelimiterIndex(langString, index);

		t.ok(result === langString.length);

		t.end();
	});

	test.end();
});

tap.test('QValueParser.parse()', (test) => {

	test.test('Empty input', (t) => {

		t.match(QValueParser.parse(), []);

		t.end();
	});

	test.test('Empty string', (t) => {

		t.match(QValueParser.parse(''), []);

		t.end();
	});

	test.test('One lang string', (t) => {

		t.match(QValueParser.parse('ro'), [
			'ro'
		]);

		t.end();
	});

	test.test('Multiple langs string', (t) => {

		t.match(QValueParser.parse('ro,en'), [
			'ro',
			'en'
		]);

		t.end();
	});

	test.test('Langs with q factor string', (t) => {

		t.match(QValueParser.parse(langString), [
			'ro',
			'en'
		]);

		t.end();
	});

	test.test('Unsorted langs string', (t) => {

		t.match(QValueParser.parse('ro,fr;q=0.7,en;q=0.8'), [
			'ro',
			'en',
			'fr'
		]);

		t.end();
	});

	test.test('Langs with whitespace string', (t) => {

		t.match(QValueParser.parse('ro, en;q=0.8,   fr;q=0.7'), [
			'ro',
			'en',
			'fr'
		]);

		t.end();
	});

	test.test('Lowercase', (t) => {

		t.match(QValueParser.parse('RO, EN', true), [
			'ro',
			'en'
		]);

		t.end();
	});

	test.end();
});