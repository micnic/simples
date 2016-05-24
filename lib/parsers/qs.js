'use strict';

// Query string parser prototype constructor
var QsParser = function () {

	// Prepare parser members
	this.buffer = [];
	this.key = '';
	this.result = {};
	this.state = 0;
	this.value = '';
};

// QS parser factory function
QsParser.create = function () {

	return new QsParser();
};

// Static method for parsing strings
QsParser.parse = function (string) {

	var parser = QsParser.create();

	// Write the string to the parser and prepare the result
	if (string) {
		parser.write(string);
		parser.end();
	}

	return parser.result;
};

// Add data to the result
QsParser.prototype.addData = function () {

	var key = decodeURIComponent(this.key),
		value = decodeURIComponent(this.value);

	// Add the key and the value to the result
	if (key) {

		// Use the array notation to force property to be an array
		if (key.substr(-2) === '[]') {

			// Remove the array square brackets
			key = key.substr(0, key.length - 2);

			// Check for a defined key in the result
			if (!this.result[key]) {
				this.result[key] = [];
			} else if (!Array.isArray(this.result[key])) {
				this.result[key] = [this.result[key]];
			}
		}

		// Add value or merge multiple values
		if (Array.isArray(this.result[key])) {
			this.result[key].push(value);
		} else if (this.result[key]) {
			this.result[key] = [this.result[key], value];
		} else {
			this.result[key] = value;
		}

		// Reset the key and the value
		this.key = '';
		this.value = '';
	}
};

// Parse key bytes
QsParser.prototype.getKey = function (current) {

	// Check for key boundaries
	if (current === 38 || current === 61) {

		// Stringify key and reset buffer
		this.key = String.fromCharCode.apply(String, this.buffer);
		this.buffer = [];

		// Add the data or continue to value parsing
		if (current === 38) {
			this.addData();
		} else if (current === 61) {
			this.state = 1;
		}
	} else {
		this.buffer.push(current);
	}
};

// Parse value bytes
QsParser.prototype.getValue = function (current) {

	// Check for values boundaries
	if (current === 38) {
		this.value = String.fromCharCode.apply(String, this.buffer);
		this.buffer = [];
		this.addData();
		this.state = 0;
	} else {
		this.buffer.push(current);
	}
};

// Write data to the parser and parse it
QsParser.prototype.write = function (data) {

	var current = data[0],
		index = 0;

	// Loop throught all received bytes
	while (current !== undefined) {

		// Parse data
		if (this.state === 0) {
			this.getKey(current);
		} else {
			this.getValue(current);
		}

		// Get next byte
		index++;
		current = data[index];
	}
};

// End parsing data
QsParser.prototype.end = function () {

	// Stringify buffer
	if (this.state === 0) {
		this.key = String.fromCharCode.apply(String, this.buffer);
	} else {
		this.value = String.fromCharCode.apply(String, this.buffer);
	}

	// Add last field
	this.addData();
};

// Export the parser
module.exports = QsParser;