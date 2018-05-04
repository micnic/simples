'use strict';

const tap = require('tap');

const CookieParser = require('simples/lib/parsers/cookie-parser');

const encode = encodeURIComponent;
const emptyString = '';
const equalsSign = '=';
const firstCookieName = 'first-cookie';
const firstCookieValue = 'first cookie value';
const firstCookie = `${firstCookieName}=${encode(firstCookieValue)}`;
const secondCookieName = 'second-cookie';
const secondCookieValue = 'second cookie value';
const secondCookie = `${secondCookieName}=${encode(secondCookieValue)}`;

tap.test('CookieParser.getNextIndexOf()', (test) => {

	const expectedIndex = firstCookie.indexOf(equalsSign);
	const getNextIndexOf = CookieParser.getNextIndexOf;

	let index = 0;

	test.test('First index', (t) => {

		const result = getNextIndexOf(equalsSign, firstCookie, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index = expectedIndex;

	test.test('Expected index', (t) => {

		const result = getNextIndexOf(equalsSign, firstCookie, index);

		t.ok(result === expectedIndex);

		t.end();
	});

	index++;

	test.test('Greater index', (t) => {

		const result = getNextIndexOf(equalsSign, firstCookie, index);

		t.ok(result === firstCookie.length);

		t.end();
	});

	test.end();
});

tap.test('CookieParser.parse()', (test) => {

	test.test('Empty input', (t) => {

		t.match(CookieParser.parse(), {});

		t.end();
	});

	test.test('Empty string', (t) => {

		t.match(CookieParser.parse(emptyString), {});

		t.end();
	});

	test.test('One cookie string', (t) => {

		t.match(CookieParser.parse(firstCookie), {
			[firstCookieName]: firstCookieValue
		});

		t.end();
	});

	test.test('Multiple cookies string', (t) => {

		t.match(CookieParser.parse(`${firstCookie}; ${secondCookie}`), {
			[firstCookieName]: firstCookieValue,
			[secondCookieName]: secondCookieValue
		});

		t.end();
	});

	test.end();
});