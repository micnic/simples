'use strict';

const { PassThrough } = require('stream');
const tap = require('tap');

const Response = require('simples/lib/client/response');

const createStream = () => {

	const stream = new PassThrough();

	stream.headers = {};
	stream.socket = {};
	stream.statusCode = 200;

	return stream;
};

tap.test('Response.prototype.constructor()', (test) => {

	const stream = createStream();
	const response = new Response(stream);

	test.equal(response._response, stream);
	test.equal(response.body, stream);
	test.equal(response.headers, stream.headers);
	test.equal(response.socket, stream.socket);
	test.equal(response.status, stream.statusCode);

	test.end();
});

tap.test('Response.prototype.buffer()', (test) => {

	test.test('No configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.buffer().then((result) => {
			t.match(result, Buffer.from('data'));
			t.end();
		});

		stream.end('data');
	});

	test.test('With limit configuration', (t) => {

		const stream = createStream();
		const body = new Response(stream);

		body.buffer({ limit: 4 }).then((result) => {
			t.match(result, Buffer.from('data'));
			t.end();
		});

		stream.end('data');
	});

	test.end();
});

tap.test('Response.prototype.json()', (test) => {

	test.test('No configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.json().then((result) => {
			t.equal(result, null);
			t.end();
		});

		stream.end('null');
	});

	test.test('With limit configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.json({ limit: 4 }).then((result) => {
			t.equal(result, null);
			t.end();
		});

		stream.end('null');
	});

	test.end();
});

tap.test('Response.prototype.qs()', (test) => {

	test.test('No configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.qs().then((result) => {
			t.match(result, {
				k: 'v'
			});

			t.end();
		});

		stream.end('k=v');
	});

	test.test('With limit configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.qs({ limit: 4 }).then((result) => {
			t.match(result, {
				k: 'v'
			});

			t.end();
		});

		stream.end('k=v');
	});

	test.end();
});

tap.test('Response.prototype.text()', (test) => {

	test.test('No configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.text().then((result) => {
			t.equal(result, 'data');

			t.end();
		});

		stream.end('data');
	});

	test.test('With limit configuration', (t) => {

		const stream = createStream();
		const response = new Response(stream);

		response.text({ limit: 4 }).then((result) => {
			t.equal(result, 'data');

			t.end();
		});

		stream.end('data');
	});

	test.end();
});