'use strict';

// Parse data with content-type multipart/form-data
var multipartParser = function (boundary) {
	this.boundary = boundary;
	this.buffer = '';
	this.content = new Buffer(0);
	this.encoding = 'binary';
	this.name = '';
	this.result = {
		body: {},
		files: {}
	};
	this.state = 0;
	this.type = '';
};

// Parse received data
multipartParser.prototype.parse = function (data) {

	var current = '',
		delimiter = '\r\n--' + this.boundary,
		index = 0,
		length = delimiter.length,
		that = this;

	// Delimit data inputs
	function getInputBoundary() {

		var buffer = that.buffer;

		// Fill the buffer with the content of the boundary
		while (current && buffer.length < length) {
			buffer += current;
			index++;
			current = data[index];
		}

		// Check the validity of the boundary structure
		if (buffer === '--' + that.boundary + '\r\n') {
			that.buffer = '';
			that.state = 1;
		} else if (buffer === '--' + that.boundary + '--') {
			that.buffer = '';
			that.state = 3;
		} else if (buffer.length >= length) {
			that.state = -1;
		} else {
			that.buffer = buffer;
		}
	}

	// Extract the needed data from the headers
	function parseHeader(expected, string) {

		var split;

		// Split the header string in name and value
		split = string.split(': ');

		// Get the header value if it is possible
		if (split.length !== 2 || split[0].toLowerCase() !== expected) {
			that.state = -1;
		} else if (expected === 'content-type') {
			that.type = split[1];
		} else if (expected === 'content-transfer-encoding') {
			that.encoding = split[1];
		}
	}

	// Extract the content type of the received file
	function parseFileHeaders() {

		var buffer = that.buffer,
			parts,
			start = 51 + that.name.length + that.filename.length;

		// Get the headers of the file from the buffer
		parts = buffer.substr(start).split('\r\n');
		that.buffer = '';

		// Check the number of headers and their order
		if (parts.length < 3 || parts.length > 5) {
			that.state = -1;
		} else if (parts.length === 4) {
			parseHeader('content-type', parts[1]);
			that.state = 2;
		} else if (parts.length === 5) {
			parseHeader('content-type', parts[1]);
			parseHeader('content-transfer-encoding', parts[2]);
			that.state = 2;
		}
	}

	// Extract data after name was parsed
	function parseAfterName() {

		var end,
			start = 38 + that.name.length;

		// Choose what to parse next
		if (that.buffer.substr(start) === '"\r\n\r\n') {
			that.buffer = '';
			that.state = 2;
		} else if (that.buffer.substr(start, 13) === '"; filename="') {
			start += 13;
			end = that.buffer.indexOf('"', start);
			that.filename = that.buffer.substr(start, end - start);
			parseFileHeaders();
		} else {
			that.state = -1;
		}
	}

	// Extract input name from the input header
	function parseName() {

		var begin = that.buffer.substr(0, 38),
			end,
			start;

		// Validate first part of the header
		if (begin.toLowerCase() === 'content-disposition: form-data; name="') {
			start = 38;
			end = that.buffer.indexOf('"', start);
			that.name = that.buffer.substr(start, end - start);
			parseAfterName();
		} else {
			that.state = -1;
		}
	}

	// Get data about input
	function getInputHeader() {

		var buffer = that.buffer;

		// Get input header
		while (current && buffer.substr(-4) !== '\r\n\r\n') {
			buffer += current;
			index++;
			current = data[index];
		}

		// Prepare the buffer
		that.buffer = buffer;

		// Parse input header
		if (buffer.substr(-4) === '\r\n\r\n') {
			parseName();
		}
	}

	// Add data to the result
	function addData() {

		var key = that.name,
			result = that.result.body,
			value = that.content;

		if (!result[key]) {
			result[key] = value;
		} else if (!Array.isArray(result[key])) {
			result[key] = [result[key], value];
		} else if (result[key].indexOf(value) < 0) {
			result[key].push(value);
		}
	}

	// Add received files
	function addFile() {

		var content,
			file,
			files = that.result.files;

		// Encode the content in the needed encoding
		if (that.encoding === 'binary') {
			content = new Buffer(that.content);
		} else if (that.encoding === 'base64') {
			content = new Buffer(that.content).toString('base64');
		} else if (that.encoding === '7bit') {
			content = new Buffer(that.content).toString('ascii');
		} else {
			content = that.content;
		}

		// Create the file object
		file = {
			filename: that.filename,
			content: content,
			type: that.type
		};

		// Add the file to the files container
		if (files[that.name] && Array.isArray(files[that.name])) {
			files[that.name].push(file);
		} else if (files[that.name]) {
			files[that.name] = [files[that.name], file];
		} else {
			files[that.name] = file;
		}
	}

	// Add append data to connection body or add files
	function addInput() {

		// Choose behavior
		if (that.filename) {
			addFile();
		} else {
			addData(that.result, that.name, that.content);
		}

		// Reset parser data
		that.state = 0;
		that.type = '';
		that.filename = '';
		that.name = '';
		that.buffer = that.buffer.substr(-that.boundary.length - 2);
	}

	// Extract the content of the input
	function parseContent() {

		var buffer = that.buffer;

		// Get input content with boundary
		while (current && buffer.substr(-length) !== delimiter) {
			buffer += current;
			index++;
			current = data[index];
		}

		that.buffer = buffer;

		// Remove the boundary from the content
		if (buffer.substr(-length) === delimiter) {
			that.content = buffer.substr(0, buffer.length - length);
			addInput();
		}
	}

	// Wait for the last boundary statement
	function getRequestEnd() {

		var buffer = that.buffer;

		// Get 2 symbols to check if it ends with \r\n
		while (current && buffer.length !== 2) {
			buffer += current;
			index++;
			current = data[index];
		}

		// Save the buffer
		that.buffer = buffer;

		// Check the parser buffer and validate them
		if (!current && buffer === '\r\n') {
			that.state = 4;
		} else {
			that.state = -1;
		}
	}

	// Check for final data chunk
	if (data !== null) {
		current = data[index];
	}

	// Parse char by char in a loop
	while (current) {

		// Stop parsing if the request is invalid
		if (this.state === -1) {
			this.buffer = data = current = '';
		}

		// Wait for boundary statement
		if (this.state === 0) {
			getInputBoundary();
		}

		// Wait for header statement
		if (this.state === 1) {
			getInputHeader();
		}

		// Wait for content of the input
		if (this.state === 2) {
			parseContent();
		}

		// Wait for ending \r\n sequence
		if (this.state === 3) {
			getRequestEnd();
		}
	}
};

// Export the parser
module.exports = multipartParser;