'use strict';

const ErrorEmitter = require('simples/lib/utils/error-emitter');
const JsonParser = require('simples/lib/parsers/json-parser');
const MultipartParser = require('simples/lib/parsers/multipart-parser');
const QsParser = require('simples/lib/parsers/qs-parser');

const { megabyte } = require('simples/lib/utils/constants');
const { PassThrough } = require('stream');

class HTTPForm {

	// Parse the provided request
	static parse(request, options) {

		const form = new PassThrough({
			readableObjectMode: true,
			writableObjectMode: true
		});

		let length = 0;
		let limit = megabyte;
		let parser = null;
		let type = request.headers['content-type'];

		// Check for config limit
		if (typeof options.limit === 'number' && options.limit >= 0) {
			limit = options.limit;
		}

		// Check for content type
		if (type) {

			// Define a parser based on the type of the receiving content
			if (typeof options.json === 'function' && /json/i.test(type)) {
				parser = JsonParser.create();
				type = 'json';
				parser.pipe(form);
			} else if (typeof options.multipart === 'function' && /multipart/i.test(type)) {
				options.multipart(form);
				try {
					parser = MultipartParser.create(request.headers['content-type']);
				} catch (error) {
					ErrorEmitter.emit(form, error);
				}
				if (parser) {
					parser.on('field', (field) => {
						form.emit('field', field);
					});
				}
				type = 'multipart';
				form.resume();
			} else if (typeof options.urlencoded === 'function' && /urlencoded/i.test(type)) {
				parser = QsParser.create();
				type = 'urlencoded';
				parser.pipe(form);
			} else {
				type = null;
			}

			// Set different behavior based on the content type
			if (type === 'json' || type === 'urlencoded') {

				let ended = false;
				let result = null;

				// Add form listeners to extract data or emit error
				form.on('data', (data) => {
					result = data;
				}).on('end', () => {
					if (!ended) {
						ended = true;
						options[type](null, result);
					}
				}).on('error', (error) => {
					ended = true;
					options[type](error, null);
				});
			}

			// Resume data receiving and listen for errors of the parser
			if (parser) {
				parser.on('error', (error) => {
					ErrorEmitter.emit(form, error);
				});
			}
		} else if (typeof options.plain === 'function') {
			type = 'plain';
			options.plain(form);
		}

		if (type) {

			// Attach request event listeners
			request.on('data', (data) => {

				// Get the read length
				length += data.length;

				// Check for request body length and parse data
				if (limit && length > limit) {
					ErrorEmitter.emit(form, Error('Request Entity Too Large'));
					request.destroy();
				} else if (parser) {
					parser.write(data);
				} else {
					form.write(data);
				}
			}).on('end', () => {
				if (parser) {
					parser.end();
					form.end();
				} else {
					form.end();
				}
			}).on('error', (error) => {
				ErrorEmitter.emit(form, error);
			});

			request.resume();
		}
	}
}

module.exports = HTTPForm;