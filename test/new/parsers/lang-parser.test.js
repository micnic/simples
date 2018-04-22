'use strict';

const tap = require('tap');

const LangParser = require('simples/lib/parsers/lang-parser');

const langString = 'ro,en;q=0.8';

tap.test('LangParser.getNameEndIndex()', (test) => {

	let expectedIndex = langString.indexOf(',');

	let index = 0;

	test.test('First index', (t) => {

		const result = LangParser.getNameEndIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex;

	test.test('Expected index', (t) => {

		const result = LangParser.getNameEndIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	expectedIndex = langString.indexOf(';');
	index++;

	test.test('Greater index', (t) => {

		const result = LangParser.getNameEndIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex + 1;

	test.test('Next greater index', (t) => {

		const result = LangParser.getNameEndIndex(langString, index);

		t.ok(result === langString.length);

		t.end();
	});

	test.end();
});

tap.test('LangParser.getNextLangDelimiterIndex()', (test) => {

	const expectedIndex = langString.indexOf(',');

	let index = 0;

	test.test('First index', (t) => {

		const result = LangParser.getNextLangDelimiterIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex;

	test.test('Expected index', (t) => {

		const result = LangParser.getNextLangDelimiterIndex(langString, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index++;

	test.test('Greater index', (t) => {

		const result = LangParser.getNextLangDelimiterIndex(langString, index);

		t.ok(result === langString.length);

		t.end();
	});

	test.end();
});

tap.test('LangParser.parse()', (test) => {

	test.test('Empty input', (t) => {

		t.match(LangParser.parse(), []);

		t.end();
	});

	test.test('Empty string', (t) => {

		t.match(LangParser.parse(''), []);

		t.end();
	});

	test.test('One lang string', (t) => {

		t.match(LangParser.parse('ro'), [
			'ro'
		]);

		t.end();
	});

	test.test('Multiple langs string', (t) => {

		t.match(LangParser.parse('ro,en'), [
			'ro',
			'en'
		]);

		t.end();
	});

	test.test('Langs with q factor string', (t) => {

		t.match(LangParser.parse(langString), [
			'ro',
			'en'
		]);

		t.end();
	});

	test.test('Unsorted langs string', (t) => {

		t.match(LangParser.parse('ro,fr;q=0.7,en;q=0.8'), [
			'ro',
			'en',
			'fr'
		]);

		t.end();
	});

	test.test('Langs with whitespace string', (t) => {

		t.match(LangParser.parse('ro, en;q=0.8,   fr;q=0.7'), [
			'ro',
			'en',
			'fr'
		]);

		t.end();
	});

	test.end();
});