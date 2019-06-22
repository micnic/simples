'use strict';

const Random = require('simples/lib/utils/random');
const { Readable } = require('stream');

const { keys } = Object;

const boundaryHexSize = 8;
const contentDispositionHeader = 'Content-Disposition';
const crlf = '\r\n';
const emptyString = '';
const equalsSign = '=';
const filenameParameter = 'filename';
const formDataDisposition = 'form-data';
const headerDelimiter = ': ';
const hmhm = '--';
const boundaryStart = hmhm.repeat(boundaryHexSize);
const nameParameter = 'name';
const parameterDelimiter = '; ';
const quotationMark = '"';

const streamEvents = {
	data: 'data',
	end: 'end',
	error: 'error'
};

class FormData extends Readable {

	/**
	 * FormData constructor
	 * @param {*} fields
	 */
	constructor(fields) {
		super();

		// Define FormData public properties
		this.boundary = boundaryStart + Random.randomHex(boundaryHexSize);
		this.buffer = [];
		this.ended = false;
		this.fields = fields;
		this.started = false;
		this.wait = false;
	}

	/**
	 * Read method implementation
	 */
	_read() {
		if (this.buffer.length) {
			this.pushBuffer();
		} else if (this.ended) {
			this.push(null);
		} else {

			// Set wait flag
			this.wait = true;

			// Start wrapping data on the first read
			if (!this.started) {
				this.started = true;
				this.wrap();
			}
		}
	}

	/**
	 * Push current buffer to the stream and reset it
	 */
	pushBuffer() {

		const data = Buffer.concat(this.buffer);

		// Reset wait flag and buffer content
		this.wait = false;
		this.buffer.splice(0, this.buffer.length);
		this.push(data);
	}

	/**
	 * Push field head
	 * @param {string} name
	 */
	pushHead(name) {

		const { filename, headers } = this.fields[name];

		let head = hmhm + this.boundary + crlf;

		// Add content disposition to the field head
		head += FormData.getContentDisposition(name, filename);

		// Add headers to the field head
		if (headers) {
			head += keys(headers).map((header) => {
				return FormData.getHeader(header, headers[header]);
			}).join(emptyString);
		}

		// Add carriage return and line feed after adding headers
		head += crlf;

		// Push field head to the buffer
		this.buffer.push(Buffer.from(head));
	}

	/**
	 * Check if a push is needed and do it
	 * @param {Buffer} data
	 */
	waitPushBuffer(data) {

		// Push current data to the buffer
		this.buffer.push(data);

		// Check for wait flag to push the buffer data
		if (this.wait) {
			this.pushBuffer();
		}
	}

	/**
	 * Wrap provided data into multipart data
	 */
	wrap() {

		const { boundary, buffer } = this;
		const iterator = new Set(keys(this.fields)).values();

		const next = () => {

			const iteration = iterator.next();

			// Check for iteration ending to end wrapping
			if (iteration.done) {

				// Set ended flag
				this.ended = true;

				// Check if a push is needed and do it
				this.waitPushBuffer(Buffer.from(hmhm + boundary + hmhm + crlf));
			} else {

				const name = iteration.value;
				const { data, stream } = this.fields[name];

				// Push current field head
				this.pushHead(name);

				// Check for data or stream data to push it to the buffer
				if (data && data.length) {

					// Add the buffer data
					if (Buffer.isBuffer(data)) {
						buffer.push(data);
					} else {
						buffer.push(Buffer.from(data));
					}

					// Check if a push is needed and do it
					this.waitPushBuffer(Buffer.from(crlf));

					// Go to the next iteration
					next();
				} else if (stream) {
					stream.on(streamEvents.data, (chunk) => {

						// Check if a push is needed and do it
						this.waitPushBuffer(chunk);
					}).on(streamEvents.end, () => {

						// Check if a push is needed and do it
						this.waitPushBuffer(Buffer.from(crlf));

						// Go to the next iteration
						next();
					}).on(streamEvents.error, (error) => {
						this.emit(streamEvents.error, error);
					});
				} else {

					// Check if a push is needed and do it
					this.waitPushBuffer(Buffer.from(crlf));

					// Go to the next iteration
					next();
				}
			}
		};

		// Start iteration
		next();
	}

	/**
	 * Get Content-Disposition header
	 * @param {string} name
	 * @param {string} filename
	 * @returns {string}
	 */
	static getContentDisposition(name, filename) {

		let value = formDataDisposition + parameterDelimiter;

		// Add name parameter to the header value
		value += FormData.getParameter(nameParameter, name);

		// Check for filename parameter to add it to the header value
		if (filename) {
			value += parameterDelimiter;
			value += FormData.getParameter(filenameParameter, filename);
		}

		return FormData.getHeader(contentDispositionHeader, value);
	}

	/**
	 * Get header string
	 * @param {string} name
	 * @param {string} value
	 * @returns {string}
	 */
	static getHeader(name, value) {

		return name + headerDelimiter + value + crlf;
	}

	/**
	 * Get parameter string
	 * @param {string} name
	 * @param {string} value
	 * @returns {string}
	 */
	static getParameter(name, value) {

		return name + equalsSign + quotationMark + value + quotationMark;
	}
}

module.exports = FormData;