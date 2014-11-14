'use strict';

var events = require('events');

// qsParser prototype constructor
var qsParser = function () {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Prepare parser members
	this.buffer = [];
	this.key = '';
	this.result = {};
	this.state = 0;
	this.value = '';
};

// Inherit from events.EventEmitter
qsParser.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: qsParser
	}
});

// Add data to the result
qsParser.prototype.addData = function () {

	var key = decodeURIComponent(this.key),
		value = decodeURIComponent(this.value);

	// Add the key and the value to the result
	if (key) {

		// Add value or merge multiple values
		if (!this.result[key]) {
			this.result[key] = value;
		} else if (!Array.isArray(this.result[key])) {
			this.result[key] = [this.result[key], value];
		} else if (this.result[key].indexOf(value) < 0) {
			this.result[key].push(value);
		}

		// Reset the key and the value
		this.key = '';
		this.value = '';
	}
};

// Parse key bytes
qsParser.prototype.getKey = function (current) {

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
qsParser.prototype.getValue = function (current) {

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
qsParser.prototype.write = function (data) {

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
qsParser.prototype.end = function () {

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
module.exports = qsParser;