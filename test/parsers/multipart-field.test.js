'use strict';

const { PassThrough } = require('stream');
const tap = require('tap');

const MultipartField = require('simples/lib/parsers/multipart-field');

tap.test('MultipartField.prototype.constuctor()', (test) => {

	const field = new MultipartField('name', 'filename');

	test.ok(field instanceof PassThrough);
	test.match(field, {
		filename: 'filename',
		headers: {},
		name: 'name'
	});

	test.end();
});

tap.test('MultipartField.prototype.buffer()', (test) => {

	test.test('No configuration', (t) => {

		const field = new MultipartField('name');

		field.buffer().then((result) => {
			t.match(result, Buffer.from('data'));
			t.end();
		});

		field.end('data');
	});

	test.test('With limit configuration', (t) => {

		const field = new MultipartField('name');

		field.buffer({ limit: 4 }).then((result) => {
			t.match(result, Buffer.from('data'));
			t.end();
		});

		field.end('data');
	});

	test.end();
});

tap.test('MultipartField.prototype.json()', (test) => {

	test.test('No configuration', (t) => {

		const field = new MultipartField('name');

		field.json().then((result) => {
			t.equal(result, null);
			t.end();
		});

		field.end('null');
	});

	test.test('With limit configuration', (t) => {

		const field = new MultipartField('name');

		field.json({ limit: 4 }).then((result) => {
			t.equal(result, null);
			t.end();
		});

		field.end('null');
	});

	test.end();
});

tap.test('MultipartField.prototype.text()', (test) => {

	test.test('No configuration', (t) => {

		const field = new MultipartField('name');

		field.text().then((result) => {
			t.equal(result, 'data');
			t.end();
		});

		field.end('data');
	});

	test.test('With limit configuration', (t) => {

		const field = new MultipartField('name');

		field.text({ limit: 4 }).then((result) => {
			t.equal(result, 'data');
			t.end();
		});

		field.end('data');
	});

	test.end();
});