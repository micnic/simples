'use strict';

var stream = require('stream'),
	utils = require('simples/utils/utils');

// Form prototype constructor
var form = function (request, config) {

	var type = request.headers['content-type'];

	// Call stream.PassThrough in this context
	stream.PassThrough.call(this);

	// Define private properties for form
	Object.defineProperties(this, {
		parser: {
			value: null,
			writable: true
		},
		type: {
			value: 'plain',
			writable: true
		}
	});

	// The container for the result of form parsing
	this.result = null;

	// Check for content type and define parser depending on it
	if (type) {
		if (config.urlencoded && type.indexOf('urlencoded') >= 0) {
			this.parser = new utils.parsers.qs();
			this.type = 'urlencoded';
		} else if (config.multipart && type.indexOf('multipart') >= 0) {
			this.parser = new utils.parsers.multipart(type);
			this.type = 'multipart';
		} else if (config.json && type.indexOf('json') >= 0) {
			this.parser = new utils.parsers.json();
			this.type = 'json';
		}
	}

	// Begin the parsing of the form
	form.parseRequest(this, request, config);
};

// Add event listeners for the request
form.parseRequest = function (instance, request, config) {

	var length = 0,
		limit = 1048576;

	// Check for config limit
	if (typeof config.limit === 'number') {
		limit = config.limit;
	}

	// Propagate parser events in the form
	if (instance.parser) {

		// Listen for 'error' event
		instance.parser.on('error', function (error) {
			instance.emit('error', error);
		});

		// Listen for multipart parser specific 'field' event
		instance.parser.on('field', function (field) {
			instance.emit('field', field);
		});
	}

	// Attach request event listeners
	request.on('readable', function () {

		var data = request.read() || new Buffer(0);

		// Get the read length
		length += data.length;

		// Check for request body length and parse data
		if (length > limit) {
			instance.emit('error', new Error('Request Entity Too Large'));
			request.destroy();
		} else if (instance.parser) {
			instance.parser.write(data);
		} else {
			instance.write(data);
		}
	}).on('end', function () {
		if (instance.parser) {
			instance.parser.end();
			instance.result = instance.parser.result;
			instance.emit('end');
		} else {
			instance.end();
		}
	});
};

// Inherit from stream.PassThrough
form.prototype = Object.create(stream.PassThrough.prototype, {
	constructor: {
		value: form
	}
});

module.exports = form;