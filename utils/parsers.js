'use strict';

var jsonParser = require('./parsers/json'),
	multipartParser = require('./parsers/multipart'),
	qsParser = require('./parsers/qs'),
	utils = require('./utils');

// Add data to a container
function addData(container, key, value) {
	if (key || value) {
		if (!container[key]) {
			container[key] = value;
		} else if (!Array.isArray(container[key])) {
			container[key] = [container[key], value];
		} else if (container[key].indexOf(value) < 0) {
			container[key].push(value);
		}
	}
};

// Prepare connection for parsing data
exports.parse = function (connection) {

	var parser = null,
		parts = [];

	// Parse depending on the content type
	if (connection.request.headers['content-type']) {

		// Split content type in two parts to get boundary if exists
		parts = connection.request.headers['content-type'].split(';');

		// Choose the content parser
		if (parts[0] === 'application/x-www-form-urlencoded') {
			parser = new qsParser();
		} else if (parts[0] === 'multipart/form-data' && parts.length > 1) {
			parser = new multipartParser(parts[1].substr(10));
		} else if (parts[0] === 'application/json') {
			parser = new jsonParser();
		}
	}

	// If no parser was defined then make connection body a buffer
	if (!parser) {
		connection.body = new Buffer(0);
	}
	
	// Receive data from the connection request
	connection.request.on('readable', function () {

		var data = connection.request.read() || new Buffer(0),
			length;

		// Parse data if parser is defined, otherwise concatenate data
		if (parser) {
			parser.parse(data.toString());
		} else {
			length = connection.body.length + data.length;
			connection.body = utils.buffer(connection.body, data, length);
		}
	}).on('end', function () {
		if (parser) {
			parser.parse(null);
			connection.body = parser.result;
		}
	});
};