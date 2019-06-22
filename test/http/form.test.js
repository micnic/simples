'use strict';

const { PassThrough } = require('stream');
const tap = require('tap');

const Form = require('simples/lib/http/form');
const FormData = require('simples/lib/client/form-data');

const createRequest = () => {

	const request = new PassThrough();

	request.headers = {};

	return request;
};

tap.test('Form.from()', (test) => {

	test.test('Valid data', (t) => {

		const request = createRequest();

		const formData = new FormData({
			'name': {
				data: 'data'
			}
		});

		request.headers = {
			'content-type': `multipart/form-data; boundary=${formData.boundary}`
		};

		Form.from(request).then((form) => {
			form.on('field', (field) => {
				t.equal(field.name, 'name');
			}).on('end', () => {
				t.end();
			});
		});

		formData.pipe(request);
	});

	test.test('Invalid data', (t) => {

		const request = createRequest();

		request.headers = {
			'content-type': `multipart/form-data; boundary=-----12345`
		};

		Form.from(request).then((form) => {
			form.on('error', (error) => {
				t.ok(error instanceof Error);
				t.end();
			});
		});

		request.end();
	});

	test.test('No boundary', (t) => {

		const request = createRequest();

		request.headers = {
			'content-type': `multipart/form-data`
		};

		Form.from(request).then(() => {
			t.fail('Promise should not be resolved');
		}).catch((error) => {
			t.ok(error instanceof Error);
			t.end();
		});
	});

	test.end();
});