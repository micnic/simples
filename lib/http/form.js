'use strict';

const { EventEmitter } = require('events');
const MultipartParser = require('simples/lib/parsers/multipart-parser');

const contentType = 'content-type';

const noBoundaryFound = 'No boundary found';

const multipartEvents = {
	data: 'data',
	end: 'end',
	error: 'error',
	field: 'field',
	newListener: 'newListener'
};

class Form extends EventEmitter {

	/**
	 * Create a new form from the provided request
	 * @param {IncomingMessage} request
	 * @returns {Promise<Form>}
	 */
	static from(request) {

		const type = request.headers[contentType];
		const boundary = MultipartParser.getBoundary(type);

		// Check for boundary to return the multipart parser
		if (boundary) {

			const parser = new MultipartParser(boundary);
			const form = new Form();

			// Delegate parser events to the form
			parser.on(multipartEvents.end, () => {
				form.emit(multipartEvents.end);
			}).on(multipartEvents.error, (error) => {
				form.emit(multipartEvents.error, error);
			}).on(multipartEvents.data, (field) => {
				form.emit(multipartEvents.field, field);
			});

			// Listen for new listener event to start piping request to parser
			form.once(multipartEvents.newListener, () => {
				// TODO: In Node 10+ use stream.pipeline()
				request.pipe(parser);
			});

			return Promise.resolve(form);
		}

		return Promise.reject(Error(noBoundaryFound));
	}
}

module.exports = Form;