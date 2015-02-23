'use strict';

var events = require('events');

// JSON parser prototype constructor
var jsonParser = function () {

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Prepare parser members
	this.buffer = '';
	this.result = null;
};

// Inherit from events.EventEmitter
jsonParser.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: jsonParser
	}
});

// Concatenate received data
jsonParser.prototype.write = function (data) {
	this.buffer += data.toString();
};

// End received data concatenation and parse it
jsonParser.prototype.end = function () {

	// Parse the received data
	try {
		this.result = JSON.parse(this.buffer);
	} catch (error) {
		this.emit('error', error);
	}

	// Reset buffer
	this.buffer = null;

	// Emit ending event
	this.emit('end');
};

// Export the parser
module.exports = jsonParser;