'use strict';

const { PassThrough } = require('stream');
const tap = require('tap');

const Body = require('simples/lib/http/body');

const createRequest = () => {

	const request = new PassThrough();

	request.headers = {};

	return request;
};

tap.test('Body.prototype.constructor()', (test) => {

	const request = createRequest();
	const body = new Body(request);

	test.equal(body._request, request);

	test.end();
});

tap.test('Body.prototype.buffer()', (test) => {

	test.test('No configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.buffer().then((result) => {
			t.match(result, Buffer.from('data'));
			t.end();
		});

		request.end('data');
	});

	test.test('With limit configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.buffer({ limit: 4 }).then((result) => {
			t.match(result, Buffer.from('data'));
			t.end();
		});

		request.end('data');
	});

	test.end();
});

tap.test('Body.prototype.json()', (test) => {

	test.test('No configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.json().then((result) => {
			t.equal(result, null);
			t.end();
		});

		request.end('null');
	});

	test.test('With limit configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.json({ limit: 4 }).then((result) => {
			t.equal(result, null);
			t.end();
		});

		request.end('null');
	});

	test.end();
});

tap.test('Body.prototype.qs()', (test) => {

	test.test('No configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.qs().then((result) => {
			t.match(result, {
				k: 'v'
			});
			t.end();
		});

		request.end('k=v');
	});

	test.test('With limit configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.qs({ limit: 4 }).then((result) => {
			t.match(result, {
				k: 'v'
			});
			t.end();
		});

		request.end('k=v');
	});

	test.end();
});

tap.test('Body.prototype.text()', (test) => {

	test.test('No configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.text().then((result) => {
			t.equal(result, 'data');
			t.end();
		});

		request.end('data');
	});

	test.test('With limit configuration', (t) => {

		const request = createRequest();
		const body = new Body(request);

		body.text({ limit: 4 }).then((result) => {
			t.equal(result, 'data');
			t.end();
		});

		request.end('data');
	});

	test.end();
});