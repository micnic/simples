'use strict';

var JSONParser = require('simples/lib/parsers/json'),
	MultipartParser = require('simples/lib/parsers/multipart'),
	QSParser = require('simples/lib/parsers/qs'),
	stream = require('stream'),
	utils = require('simples/utils/utils');

// Form prototype constructor
var Form = function (request, config) {

	var length = 0,
		limit = 1048576,
		that = this,
		type = request.headers['content-type'];

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

	// Check for config limit
	if (typeof config.limit === 'number' && config.limit >= 0) {
		limit = config.limit;
	}

	// Check for content type and define parser depending on it
	if (type) {
		if (config.urlencoded && /urlencoded/i.test(type)) {
			this.parser = new QSParser();
			this.type = 'urlencoded';
		} else if (config.multipart && /multipart/i.test(type)) {
			this.parser = new MultipartParser(type);
			this.parser.on('field', function (field) {
				that.emit('field', field);
			});
			this.type = 'multipart';
		} else if (config.json && /json/i.test(type)) {
			this.parser = new JSONParser();
			this.type = 'json';
		}

		// Resume data receiving and listen for errors of the parser
		if (this.parser) {
			this.resume();
			this.parser.on('error', function (error) {
				utils.emitError(that, error);
			});
		}
	}

	// Attach request event listeners
	request.on('readable', function () {

		var data = this.read() || new Buffer(0);

		// Get the read length
		length += data.length;

		// Check for request body length and parse data
		if (length > limit) {
			that.emit('error', new Error('Request Entity Too Large'));
			this.destroy();
		} else if (that.parser) {
			that.parser.write(data);
		} else {
			that.write(data);
		}
	}).on('end', function () {
		if (that.parser) {
			that.parser.end();
			that.result = that.parser.result;
			that.end();
		} else {
			that.end();
		}
	});
};

// Inherit from stream.PassThrough
Form.prototype = Object.create(stream.PassThrough.prototype, {
	constructor: {
		value: Form
	}
});

module.exports = Form;