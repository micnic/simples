'use strict';

const QSParser = require('simples/lib/parsers/qs-parser');
const uv = require('uv');
const { inflate, gunzip } = require('zlib');

const megabyte = 1048576; // Bytes in one megabyte

const contentEncoding = 'content-encoding';

const invalidUTF8Data = Error('Invalid UTF-8 data received');
const tooLongData = Error('Too long data received');

const encodings = {
	deflate: 'deflate',
	gzip: 'gzip'
};

const streamEvents = {
	data: 'data',
	end: 'end',
	error: 'error'
};

class StreamUtils {

	/**
	 * Collect stream data and decode it based on the provided encoding
	 * @param {stream.Readable} stream
	 * @param {number} limit
	 * @returns {Promise<Buffer>}
	 */
	static decodeBuffer(stream, limit) {

		const { headers } = stream;
		const encoding = StreamUtils.getEncoding(headers[contentEncoding]);

		return StreamUtils.toBuffer(stream, limit).then((body) => {

			// Check for deflate encoding
			if (encoding === encodings.deflate) {
				return new Promise((resolve, reject) => {
					inflate(body, (error, result) => {
						if (error) {
							reject(error);
						} else {
							resolve(result);
						}
					});
				});
			}

			// Check for gzip encoding
			if (encoding === encodings.gzip) {
				return new Promise((resolve, reject) => {
					gunzip(body, (error, result) => {
						if (error) {
							reject(error);
						} else {
							resolve(result);
						}
					});
				});
			}

			return body;
		});
	}

	/**
	 * Get lower case value of the content encoding header
	 * @param {string} header
	 * @returns {string}
	 */
	static getEncoding(header) {

		// Check if header is present and return lower case value
		if (header) {
			return header.toLowerCase();
		}

		return '';
	}

	/**
	 * Collect stream data and parse the JSON data from it
	 * @param {stream.Readable} stream
	 * @param {number} limit
	 * @returns {Promise<*>}
	 */
	static parseJSON(stream, limit) {

		return StreamUtils.toString(stream, limit).then((body) => {
			try {
				return JSON.parse(body);
			} catch (error) {
				return Promise.reject(error);
			}
		});
	}

	/**
	 * Collect stream data and parse the query string data from it
	 * @param {stream.Readable} stream
	 * @param {number} limit
	 * @returns {Promise<StringContainer>}
	 */
	static parseQS(stream, limit) {

		return StreamUtils.toString(stream, limit).then((body) => {
			return QSParser.parse(body);
		});
	}

	/**
	 * Collect stream data to a buffer
	 * @param {stream.Readable} stream
	 * @param {number} limit
	 * @returns {Promise<Buffer>}
	 */
	static toBuffer(stream, limit = megabyte) {

		return new Promise((resolve, reject) => {

			const body = [];

			let length = 0;

			// Collect all data
			stream.on(streamEvents.data, (data) => {

				// Increase total buffer length
				length += data.length;

				// Check if limit is exceeded
				if (limit && length > limit) {
					// In Node 10+ just send the error to destroy method
					stream.emit('error', tooLongData);
					stream.destroy();
				} else {
					body.push(data);
				}
			}).on(streamEvents.end, () => {
				resolve(Buffer.concat(body));
			}).on(streamEvents.error, reject);
		});
	}

	/**
	 * Collect stream data to a string
	 * @param {stream.Readable} stream
	 * @param {number} limit
	 * @returns {Promise<string>}
	 */
	static toString(stream, limit) {

		return StreamUtils.toBuffer(stream, limit).then((body) => {

			// Validate received body
			if (uv(body)) {
				return String(body);
			}

			return Promise.reject(invalidUTF8Data);
		});
	}
}

module.exports = StreamUtils;