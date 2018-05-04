'use strict';

const sinon = require('sinon');
const tap = require('tap');

const HttpForm = require('simples/lib/http/form');
const { PassThrough } = require('stream');

tap.test('HttpForm.parse()', (test) => {

	test.test('No content type', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {};

		sinon.spy(fakeRequest, 'on');

		HttpForm.parse(fakeRequest, {});

		t.ok(fakeRequest.on.notCalled);

		fakeRequest.on.restore();

		t.end();
	});

	test.test('Invalid content type', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {
			'content-type': 'Invalid Type'
		};

		sinon.spy(fakeRequest, 'on');

		HttpForm.parse(fakeRequest, {});

		t.ok(fakeRequest.on.notCalled);

		fakeRequest.on.restore();

		t.end();
	});

	test.test('No content type with plain handler', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {};

		fakeRequest.end('data');

		HttpForm.parse(fakeRequest, {
			plain(form) {
				form.on('data', (data) => {
					t.ok(String(data) === 'data');
				}).on('end', () => {
					t.end();
				});
			}
		});
	});

	test.test('No content type with plain handler and error emitted', (t) => {

		const fakeRequest = new PassThrough();
		const someError = Error('Some error');

		fakeRequest.headers = {};

		HttpForm.parse(fakeRequest, {
			plain(form) {
				form.on('error', (error) => {
					t.ok(error === someError);
					t.end();
				});
			}
		});

		fakeRequest.emit('error', someError);
	});

	test.test('No content type with plain handler and limit', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {};

		fakeRequest.end('data');

		HttpForm.parse(fakeRequest, {
			limit: 4,
			plain(form) {
				form.on('data', (data) => {
					t.ok(String(data) === 'data');
				}).on('end', () => {
					t.end();
				});
			}
		});
	});

	test.test('No content type with plain handler and limit exceeded', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {};

		fakeRequest.destroy = () => null;

		fakeRequest.end('data');

		HttpForm.parse(fakeRequest, {
			limit: 1,
			plain(form) {
				form.on('error', (error) => {
					t.ok(error instanceof Error);
					t.end();
				});
			}
		});
	});

	test.test('No content type with plain handler and infinite limit', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {};

		fakeRequest.end('data');

		HttpForm.parse(fakeRequest, {
			limit: 0,
			plain(form) {
				form.on('data', (data) => {
					t.ok(String(data) === 'data');
				}).on('end', () => {
					t.end();
				});
			}
		});
	});

	test.test('JSON data', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {
			'content-type': 'application/json'
		};

		fakeRequest.end('{}');

		HttpForm.parse(fakeRequest, {
			json(error, result) {
				t.ok(error === null);
				t.match(result, {});
				t.end();
			}
		});
	});

	test.test('invalid JSON data', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {
			'content-type': 'application/json'
		};

		fakeRequest.end('{');

		HttpForm.parse(fakeRequest, {
			json(error, result) {
				t.ok(error instanceof Error);
				t.ok(result === null);
				t.end();
			}
		});
	});

	test.test('URL encoded data', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {
			'content-type': 'application/x-www-form-urlencoded'
		};

		fakeRequest.end('a=1');

		HttpForm.parse(fakeRequest, {
			urlencoded(error, result) {
				t.ok(error === null);
				t.match(result, {
					a: 1
				});
				t.end();
			}
		});
	});

	test.test('Multipart form data', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {
			'content-type': 'multipart/form-data;boundary="boundary"'
		};

		fakeRequest.end('--boundary\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--boundary--\r\n');

		HttpForm.parse(fakeRequest, {
			multipart(form) {
				form.on('field', (field) => {
					field.on('data', (data) => {
						t.ok(String(data) === 'value');
					});
				}).on('end', () => {
					t.end();
				});
			}
		});
	});

	test.test('Multipart form data without boundary', (t) => {

		const fakeRequest = new PassThrough();

		fakeRequest.headers = {
			'content-type': 'multipart/form-data'
		};

		fakeRequest.end('--boundary\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--boundary--\r\n');

		HttpForm.parse(fakeRequest, {
			multipart(form) {
				form.on('end', () => {
					t.end();
				}).on('error', (error) => {
					t.ok(error instanceof Error);
				});
			}
		});
	});

	test.end();
});