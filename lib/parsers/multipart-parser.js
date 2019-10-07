'use strict';

const MultipartField = require('simples/lib/parsers/multipart-field');
const { Transform } = require('stream');

const carriageReturn = 13; // Char code for "\r" (carriage return)
const hyphenMinus = 45; // Char code for "-" (hyphen minus)
const initialBoundaryIndex = 2; // Starting index for boundary parsing
const lineFeed = 10; // Char code for "\n" (line feed)

// Stream options to read in object mode
const readableObjectMode = {
	readableObjectMode: true
};

// Regular expression to match full boundary declaration
const boundaryMatchRE = /boundary=(?:"([^"]+)"|([^;]+))/i;

// Regular expression to extract file disposition
const dispositionRE = /^form-data; name="([^"]+)"(?:; filename="(.*?)")?$/i;

// Multipart parser errors
const invalidContentDisposition = 'Invalid content disposition';
const invalidHeader = 'Invalid header received';
const invalidMultipartEnding = 'Invalid multipart data ending';
const invalidParserState = 'Invalid parser state';
const noHeaderNameDelimiter = 'No header name delimiter found';
const unexpectedBoundarySymbol = 'Unexpected boundary symbol found';
const unfinishedMultipartData = 'Unfinished multipart data';

// Multipart parser states
const expectData = Symbol('expect-data');
const expectFirstBoundary = Symbol('expect-first-boundary');
const expectHeader = Symbol('expect-header');
const expectRequestEnd = Symbol('expect-request-end');
const parsingFailed = Symbol('parsing-failed');
const parsingFinished = Symbol('parsing-finished');

class MultipartParser extends Transform {

	/**
	 * MultipartParser constructor
	 * @param {string} boundary
	 */
	constructor(boundary) {

		super(readableObjectMode);

		// Define multipart parser members
		this.boundary = Buffer.from(`\r\n--${boundary}`);
		this.boundaryIndex = initialBoundaryIndex;
		this.boundaryLength = this.boundary.length;
		this.buffer = [];
		this.expect = expectFirstBoundary;
		this.field = null;
		this.header = '';
		this.prev = 0;
		this.startIndex = 0;
		this.stopIndex = 0;
	}

	/**
	 * Flush method implementation
	 * @param {Callback} callback
	 */
	_flush(callback) {

		// Check if the parsing ended correctly
		if (this.expect === parsingFinished) {
			callback(null);
		} else {
			this.emitError(Error(unfinishedMultipartData), callback);
		}
	}

	/**
	 * Transform method implementation
	 * @param {string|Buffer} chunk
	 * @param {string} encoding
	 * @param {Callback} callback
	 */
	_transform(chunk, encoding, callback) {

		const { length } = chunk;

		let index = 0;

		// Loop through all received bytes
		while (index < length && this.expect !== parsingFailed) {

			// Parse current byte
			this.parseByte(chunk, chunk[index], index, callback);

			// Get next byte
			index++;
		}

		// If the parsing is not failed then end the current transform
		if (this.expect !== parsingFailed) {
			callback(null);
		}
	}

	/**
	 * Set failed parsing and send the error with the callback
	 * @param {Error} error
	 * @param {Callback} callback
	 */
	emitError(error, callback) {
		this.expect = parsingFailed;
		callback(error);
	}

	/**
	 * Validate parsing end
	 * @param {number} byte
	 * @param {Callback} callback
	 */
	endParsing(byte, callback) {
		if (byte === carriageReturn && this.prev === 0) {
			this.prev = carriageReturn;
		} else if (byte === lineFeed && this.prev === carriageReturn) {
			this.expect = parsingFinished;
		} else {
			this.emitError(Error(invalidMultipartEnding), callback);
		}
	}

	/**
	 * Add last chunk of data, reset parser members and set next state
	 * @param {Buffer} data
	 * @param {symbol} expect
	 */
	endPartData(data, expect) {

		// Write last slice
		this.field.end(data.slice(this.startIndex, this.stopIndex));

		// Reset parser members
		this.field = null;
		this.prev = 0;
		this.boundaryIndex = 0;
		this.startIndex = 0;
		this.stopIndex = 0;

		// Set what to expect next
		this.expect = expect;
	}

	/**
	 * Get chunks of data
	 * @param {Buffer} data
	 * @param {number} byte
	 * @param {number} index
	 * @param {Callback} callback
	 */
	getData(data, byte, index, callback) {

		// Filter boundary bytes
		if (byte === this.boundary[this.boundaryIndex]) {
			if (this.boundaryIndex === 0) {
				this.stopIndex = index;
			}
			this.boundaryIndex++;
		} else if (this.boundaryIndex === this.boundaryLength) {
			if (byte === carriageReturn || byte === hyphenMinus) {
				this.prev = byte;
				this.boundaryIndex++;
			} else {
				this.emitError(Error(unexpectedBoundarySymbol), callback);
			}
		} else if (this.boundaryIndex > this.boundaryLength) {
			this.validateEndPartData(data, byte, callback);
		} else if (index === 0 && this.boundaryIndex > 0) {
			this.field.write(this.boundary.slice(0, this.boundaryIndex));
			this.boundaryIndex = 0;
		} else if (this.boundaryIndex > 0 && byte === this.boundary[0]) {
			this.boundaryIndex = 1;
			this.stopIndex = index;
		} else {
			this.boundaryIndex = 0;
			this.stopIndex = index;
		}

		// Check for last index in data to write the data to the field
		if (index === data.length - 1 && this.expect === expectData) {
			this.field.write(data.slice(this.startIndex));
			this.startIndex = 0;
			this.stopIndex = 0;
		}
	}

	/**
	 * Get header name and value for a field
	 * @param {number} byte
	 * @param {number} index
	 * @param {Callback} callback
	 */
	getHeader(byte, index, callback) {
		if (byte === carriageReturn) {
			this.prev = carriageReturn;
		} else if (byte === lineFeed && this.prev === carriageReturn) {

			// Reset the previous byte
			this.prev = 0;

			// Check for header to continue parsing it or emit the field
			if (this.header) {
				this.parseHeader(callback);
			} else {
				this.expect = expectData;
				this.startIndex = index + 1;
				this.stopIndex = this.startIndex;
				this.push(this.field);
			}
		} else {
			this.header += String.fromCharCode(byte);
		}
	}

	/**
	 * Create a new part based on content disposition
	 * @param {string} disposition
	 * @param {Callback} callback
	 */
	newPart(disposition, callback) {

		const title = disposition.match(dispositionRE);

		// Check for a valid disposition and create a new field
		if (title) {
			this.field = new MultipartField(title[1], title[2]);
		} else {
			this.emitError(Error(invalidContentDisposition), callback);
		}
	}

	/**
	 * Parse current byte
	 * @param {Buffer} chunk
	 * @param {number} byte
	 * @param {number} index
	 * @param {Callback} callback
	 */
	parseByte(chunk, byte, index, callback) {

		// Parse data
		if (this.expect === expectFirstBoundary) {
			this.skipFirstBoundary(byte, callback);
		} else if (this.expect === expectHeader) {
			this.getHeader(byte, index, callback);
		} else if (this.expect === expectData) {
			this.getData(chunk, byte, index, callback);
		} else if (this.expect === expectRequestEnd) {
			this.endParsing(byte, callback);
		} else {
			this.emitError(Error(invalidParserState), callback);
		}
	}

	/**
	 * Extract header name and value from header definition
	 * @param {Callback} callback
	 */
	parseHeader(callback) {

		const { field, header } = this;
		const index = header.indexOf(':');
		const key = header.substring(0, index).trim().toLowerCase();
		const value = header.substring(index + 1).trim();

		// Reset header
		this.header = '';

		// Check if colon found and get the header name and value
		if (index > 0) {
			if (!field && key === 'content-disposition') {
				this.newPart(value);
				this.field.headers['content-disposition'] = value;
			} else if (field) {
				field.headers[key] = value;
			} else {
				this.emitError(Error(invalidHeader), callback);
			}
		} else {
			this.emitError(Error(noHeaderNameDelimiter), callback);
		}
	}

	/**
	 * Skip the beginning of the multipart data
	 * @param {number} byte
	 * @param {Callback} callback
	 */
	skipFirstBoundary(byte, callback) {

		const index = this.boundaryIndex;

		// Check current byte to match boundary
		if (byte === this.boundary[index]) {
			this.boundaryIndex++;
		} else if (index === this.boundaryLength && byte === carriageReturn) {
			this.prev = carriageReturn;
		} else if (byte === lineFeed && this.prev === carriageReturn) {
			this.boundaryIndex = 0;
			this.prev = 0;
			this.expect = expectHeader;
		} else {
			this.emitError(Error(unexpectedBoundarySymbol), callback);
		}
	}

	/**
	 * Validate end of part data and add the last chunk of data
	 * @param {Buffer} data
	 * @param {number} byte
	 * @param {Callback} callback
	 */
	validateEndPartData(data, byte, callback) {
		if (byte === lineFeed && this.prev === carriageReturn) {
			this.endPartData(data, expectHeader);
		} else if (byte === hyphenMinus && this.prev === hyphenMinus) {
			this.endPartData(data, expectRequestEnd);
		} else {
			this.emitError(Error(unexpectedBoundarySymbol), callback);
		}
	}

	/**
	 * Extract boundary from the content type header
	 * @param {string} contentType
	 */
	static getBoundary(contentType) {

		const match = contentType.match(boundaryMatchRE);

		// Check for boundary match
		if (match) {
			if (match[1]) {
				return match[1];
			}

			return match[2];
		}

		return null;
	}
}

MultipartParser.states = {
	expectData,
	expectFirstBoundary,
	expectHeader,
	expectRequestEnd,
	parsingFailed,
	parsingFinished
};

module.exports = MultipartParser;