'use strict';

const { PassThrough, Readable } = require('stream');
const tap = require('tap');

const FormData = require('simples/lib/client/form-data');

tap.test('FormData.prototype.constructor()', (test) => {

	const fields = {};
	const formData = new FormData(fields);

	test.ok(formData instanceof Readable);
	test.equal(typeof formData.boundary, 'string');
	test.equal(formData.boundary.length, 32);
	test.ok(Array.isArray(formData.buffer));
	test.equal(formData.buffer.length, 0);
	test.equal(formData.ended, false);
	test.equal(formData.fields, fields);
	test.equal(formData.started, false);
	test.equal(formData.wait, false);

	test.end();
});

tap.test('FormData.getHeader()', (test) => {

	test.equal(FormData.getHeader('name', 'value'), 'name: value\r\n');

	test.end();
});

tap.test('FormData.getParameter()', (test) => {

	test.equal(FormData.getParameter('name', 'value'), 'name="value"');

	test.end();
});

tap.test('FormData.getContentDisposition()', (test) => {

	test.equal(FormData.getContentDisposition('name'), 'Content-Disposition: form-data; name="name"\r\n');
	test.equal(FormData.getContentDisposition('name', 'filename'), 'Content-Disposition: form-data; name="name"; filename="filename"\r\n');

	test.end();
});

tap.test('FormData.prototype.pushBuffer()', (test) => {

	const formData = new FormData({});

	formData.buffer = [Buffer.from('data')];

	formData.once('data', (data) => {
		test.equal(Buffer.compare(Buffer.from('data'), data), 0);
	}).on('end', () => {
		test.end();
	});

	formData.pushBuffer();

	test.equal(formData.buffer.length, 0);
});

tap.test('FormData.prototype.waitPushBuffer()', (test) => {

	test.test('No wait', (t) => {

		const formData = new FormData({});

		formData.once('data', (data) => {
			t.equal(Buffer.compare(Buffer.from('data'), data), 0);
		}).on('end', () => {
			t.end();
		});

		formData.waitPushBuffer(Buffer.from('data'));

		t.equal(formData.buffer.length, 1);
	});

	test.test('Wait', (t) => {

		const formData = new FormData({});

		formData.once('data', (data) => {
			t.equal(Buffer.compare(Buffer.from('data'), data), 0);
		}).on('end', () => {
			t.end();
		});

		formData.wait = true;
		formData.waitPushBuffer(Buffer.from('data'));

		t.equal(formData.buffer.length, 0);
	});

	test.end();
});

tap.test('FormData.prototype.pushHead()', (test) => {

	test.test('No headers', (t) => {

		const formData = new FormData({
			field: {}
		});

		formData.pushHead('field');

		t.equal(formData.buffer.length, 1);
		t.equal(String(formData.buffer[0]), '--' +
			formData.boundary + '\r\n' +
			'Content-Disposition: form-data; name="field"' + '\r\n' +
			'\r\n');

		t.end();
	});

	test.test('With headers', (t) => {

		const formData = new FormData({
			field: {
				headers: {
					'Content-Type': 'text/plain'
				}
			}
		});

		formData.pushHead('field');

		t.equal(formData.buffer.length, 1);
		t.equal(String(formData.buffer[0]), '--' +
			formData.boundary + '\r\n' +
			'Content-Disposition: form-data; name="field"' + '\r\n' +
			'Content-Type: text/plain' + '\r\n' +
			'\r\n');

		t.end();
	});

	test.end();
});

tap.test('FormData.prototype.wrap()', (test) => {

	test.test('No data', (t) => {

		const body = [];
		const formData = new FormData({
			field: {}
		});

		formData.on('data', (data) => {
			body.push(data);
		}).on('end', () => {
			t.equal(String(Buffer.concat(body)), '--' +
			formData.boundary + '\r\n' +
			'Content-Disposition: form-data; name="field"' + '\r\n' +
			'\r\n' + '\r\n' + '--' +
			formData.boundary + '--' + '\r\n');

			t.end();
		});
	});

	test.test('String data', (t) => {

		const body = [];
		const formData = new FormData({
			field: {
				data: 'data'
			}
		});

		formData.on('data', (data) => {
			body.push(data);
		}).on('end', () => {
			t.equal(String(Buffer.concat(body)), '--' +
			formData.boundary + '\r\n' +
			'Content-Disposition: form-data; name="field"' + '\r\n' +
			'\r\n' + 'data' + '\r\n' + '--' +
			formData.boundary + '--' + '\r\n');

			t.end();
		});
	});

	test.test('Buffer data', (t) => {

		const body = [];
		const formData = new FormData({
			field: {
				data: Buffer.from('data')
			}
		});

		formData.on('data', (data) => {
			body.push(data);
		}).on('end', () => {
			t.equal(String(Buffer.concat(body)), '--' +
			formData.boundary + '\r\n' +
			'Content-Disposition: form-data; name="field"' + '\r\n' +
			'\r\n' + 'data' + '\r\n' + '--' +
			formData.boundary + '--' + '\r\n');

			t.end();
		});
	});

	test.test('Stream data', (t) => {

		const body = [];
		const stream = new PassThrough();
		const someError = Error('Some Error');

		const formData = new FormData({
			field: {
				stream
			}
		});

		stream.write('d');
		stream.write('a');
		stream.write('t');
		stream.end('a');

		formData.on('data', (data) => {
			body.push(data);
		}).on('end', () => {
			t.equal(String(Buffer.concat(body)), '--' +
			formData.boundary + '\r\n' +
			'Content-Disposition: form-data; name="field"' + '\r\n' +
			'\r\n' + 'data' + '\r\n' + '--' +
			formData.boundary + '--' + '\r\n');

			stream.emit('error', someError);

			t.end();
		}).on('error', (error) => {
			t.equal(error, someError);
		});
	});

	test.end();
});