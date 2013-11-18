'use strict';

// Parse data with content-type x-www-form-urlencoded
var qsParser = function () {
	this.key = '';
	this.result = {};
	this.state = 0;
	this.value = '';
};

// Parse received data
qsParser.prototype.parse = function (data) {

	var current = '',
		index = 0,
		that = this;

	// Add data to the result
	function addData() {

		var key = decodeURIComponent(that.key),
			result = that.result,
			value = decodeURIComponent(that.value);

		// Check key entry
		if (!result[key]) {
			result[key] = value;
		} else if (!Array.isArray(result[key])) {
			result[key] = [result[key], value];
		} else if (result[key].indexOf(value) < 0) {
			result[key].push(value);
		}

		// Reset data
		that.key = '';
		that.state = 0;
		that.value = '';

		// Get next char if data available
		if (data) {
			index++;
			current = data[index];
		}
	}

	// Parse query string key
	function parseKey() {

		var key = that.key;

		// Concatenate key characters
		while (current && current !== '=' && current !== '&') {
			key += current;
			index++;
			current = data[index];
		}

		// Prepare the key
		that.key = key;

		// Check when the key is ready
		if (current === '=' || current === '&') {
			index++;
			current = data[index];
			that.state = 1;
		}
	}

	// Parse query string value
	function parseValue() {

		var value = that.value;

		// Concatenate value characters
		while (current && current !== '&') {
			value += current;
			index++;
			current = data[index];
		}

		// Prepare the value
		that.value = value;

		// Check when the key and the value are ready
		if (current === '&') {
			addData();
		}
	}

	// Check for final data chunk
	if (data === null) {
		addData();
	} else {
		current = data[index];
	}

	// Parse char by char in a loop
	while (current) {

		// Wait for key
		if (this.state === 0) {
			parseKey();
		}

		// Wait for value
		if (this.state === 1) {
			parseValue();
		}
	}
};

// Export the parser
module.exports = qsParser;