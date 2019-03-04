'use strict';

const ErrorEmitter = require('simples/lib/utils/error-emitter');
const JSONParser = require('simples/lib/parsers/json-parser');
const MultipartParser = require('simples/lib/parsers/multipart-parser');
const QSParser = require('simples/lib/parsers/qs-parser');

const { megabyte } = require('simples/lib/utils/constants');
const { PassThrough } = require('stream');

const readableWritableObjectMode = {
	readableObjectMode: true,
	writableObjectMode: true
};

class HTTPForm {

	// Parse the provided request
	static parse(request, options) {

		const form = new PassThrough(readableWritableObjectMode);
		const type = request.headers['content-type'];
		const { json, multipart, plain, urlencoded } = options;

		let handler = null;
		let length = 0;
		let limit = megabyte;
		let parser = null;

		// Check for config limit
		if (typeof options.limit === 'number' && options.limit >= 0) {
			limit = options.limit;
		}

		// Check for content type
		if (type) {

			// Define a parser based on the type of the receiving content
			if (typeof json === 'function' && /json/i.test(type)) {
				parser = JSONParser.create();
				handler = json;

				// In Node 10+ use stream.pipeline()
				parser.pipe(form);
			} else if (typeof multipart === 'function' && /multipart/i.test(type)) {

				const boundary = MultipartParser.getBoundary(type);

				// Handle the form
				handler = multipart;
				multipart(form);
				form.resume();

				// Start parsing multipart data only if boundary available
				if (boundary) {
					parser = MultipartParser.create(boundary);
					parser.on('field', (field) => {
						form.emit('field', field);
					});
				} else {
					ErrorEmitter.emit(form, Error('No boundary found'));
				}
			} else if (typeof urlencoded === 'function' && /urlencoded/i.test(type)) {
				parser = QSParser.create();
				handler = urlencoded;

				// In Node 10+ use stream.pipeline()
				parser.pipe(form);
			}

			// Set different behavior based on the content type
			if (handler === json || handler === urlencoded) {

				let ended = false;
				let result = null;

				// Add form listeners to extract data or emit error
				form.on('data', (data) => {
					result = data;
				}).on('end', () => {
					if (!ended) {
						ended = true;
						handler(null, result);
					}
				}).on('error', (error) => {
					ended = true;
					handler(error, null);
				});
			}

			// Resume data receiving and listen for errors of the parser
			if (parser) {
				parser.on('error', (error) => {
					ErrorEmitter.emit(form, error);
				});
			}
		} else if (typeof plain === 'function') {
			handler = plain;
			plain(form);
		}

		if (handler) {

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
				}

				form.end();
			}).on('error', (error) => {
				ErrorEmitter.emit(form, error);
			}).resume();
		}
	}
}

module.exports = HTTPForm;