'use strict';

const { PassThrough, Transform } = require('stream');

const {
	carriageReturn,
	hyphenMinus,
	initialBoundaryIndex,
	lineFeed,
	readableObjectMode
} = require('simples/lib/utils/constants');

const {
	expectFirstBoundary,
	expectHeader,
	expectData,
	expectRequestEnd,
	parsingFailed,
	parsingFinished
} = require('simples/lib/utils/symbols');

// Regular expression to match full boundary declaration
const boundaryMatchRE = /boundary=(?:"([^"]+)"|([^;]+))/i;

// Regular expression to extract file disposition
const dispositionRE = /^form-data; name="([^"]+)"(?:; filename="(.*?)")?$/i;

const invalidContentDisposition = Error('Invalid content disposition');
const invalidHeader = Error('Invalid header received');
const invalidMultipartEnding = Error('Invalid multipart data ending');
const invalidParserState = Error('Invalid parser state');
const noHeaderNameDelimiter = Error('No header name delimiter found');
const unexpectedBoundarySymbol = Error('Unexpected boundary symbol found');
const unfinishedMultipartData = Error('Unfinished multipart data');

class MultipartField extends PassThrough {

	constructor(name, filename) {

		super();

		// Prepare field members
		this.name = name;
		this.headers = {};

		// Check for file upload to add filename and type
		if (filename) {
			this.filename = filename;
		}
	}
}

class MultipartParser extends Transform {

	constructor(boundary) {

		super(readableObjectMode);

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

	// Flush method implementation
	_flush(callback) {

		// Check if the parsing ended correctly
		if (this.expect === parsingFinished) {
			callback(null);
		} else {
			this.emitError(unfinishedMultipartData, callback);
		}
	}

	// Transform method implementation
	_transform(chunk, encoding, callback) {

		const length = chunk.length;

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

	// Set failed parsing and send the error with the callback
	emitError(error, callback) {
		this.expect = parsingFailed;
		callback(error);
	}

	// Validate parsing end
	endParsing(byte, callback) {
		if (byte === carriageReturn && this.prev === 0) {
			this.prev = carriageReturn;
		} else if (byte === lineFeed && this.prev === carriageReturn) {
			this.expect = parsingFinished;
		} else {
			this.emitError(invalidMultipartEnding, callback);
		}
	}

	// Add last chunk of data, reset parser members and set next state
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

	// Get chunks of data
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
				this.emitError(unexpectedBoundarySymbol, callback);
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

		if (index === data.length - 1 && this.expect === expectData) {
			this.field.write(data.slice(this.startIndex));
			this.startIndex = this.stopIndex = 0;
		}
	}

	// Get header name and value for a field
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
				this.startIndex = this.stopIndex = index + 1;
				this.emit('field', this.field);
			}
		} else {
			this.header += String.fromCharCode(byte);
		}
	}

	// Create a new part based on content disposition
	newPart(disposition, callback) {

		const title = disposition.match(dispositionRE);

		// Check for a valid disposition and create a new field
		if (title) {
			this.field = new MultipartField(title[1], title[2]);
		} else {
			this.emitError(invalidContentDisposition, callback);
		}
	}

	// Parse current byte
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
			this.emitError(invalidParserState, callback);
		}
	}

	// Extract header name and value from header definition
	parseHeader(callback) {

		const field = this.field;
		const index = this.header.indexOf(':');
		const key = this.header.substring(0, index).trim().toLowerCase();
		const value = this.header.substring(index + 1).trim();

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
				this.emitError(invalidHeader, callback);
			}
		} else {
			this.emitError(noHeaderNameDelimiter, callback);
		}
	}

	// Skip the beginning of the multipart data
	skipFirstBoundary(byte, callback) {

		const index = this.boundaryIndex;

		if (byte === this.boundary[index]) {
			this.boundaryIndex++;
		} else if (index === this.boundaryLength && byte === carriageReturn) {
			this.prev = carriageReturn;
		} else if (byte === lineFeed && this.prev === carriageReturn) {
			this.boundaryIndex = 0;
			this.prev = 0;
			this.expect = expectHeader;
		} else {
			this.emitError(unexpectedBoundarySymbol, callback);
		}
	}

	// Validate end of part data and add the last chunk of data
	validateEndPartData(data, byte, callback) {
		if (byte === lineFeed && this.prev === carriageReturn) {
			this.endPartData(data, expectHeader);
		} else if (byte === hyphenMinus && this.prev === hyphenMinus) {
			this.endPartData(data, expectRequestEnd);
		} else {
			this.emitError(unexpectedBoundarySymbol, callback);
		}
	}

	// Extract boundary from the content type header
	static getBoundary(contentType) {

		const match = contentType.match(boundaryMatchRE);

		let boundary = null;

		// Check for boundary match
		if (match) {
			if (match[1]) {
				boundary = match[1];
			} else {
				boundary = match[2];
			}
		}

		return boundary;
	}
}

MultipartParser.MultipartField = MultipartField;

module.exports = MultipartParser;