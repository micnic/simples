'use strict';

var fs = require('fs'),
	stream = require('stream'),
	url = require('url');

// Check if the origin header is accepted by the host (CORS)
exports.accepts = function (host, request) {

	var accepted = true,
		origin = request.headers.origin;

	// Get the hostname from the origin
	origin = url.parse(origin).hostname || origin;

	// Check if the origin is accepted
	if (origin !== request.headers.host.split(':')[0]) {
		if (host.conf.acceptedOrigins.indexOf(origin) < 0) {
			accepted = host.conf.acceptedOrigins[0] === '*';
		} else {
			accepted = host.conf.acceptedOrigins[0] !== '*';
		}
	}

	return accepted;
};

// Create a new Buffer instance from a list of buffers
exports.buffer = function () {

	var args = arguments,
		buffers = Array.prototype.slice.call(args, 0, args.length - 1);

	return Buffer.concat(buffers, args[args.length - 1]);
};

// Return a random session name of 16 characters
exports.generateSessionName = function () {

	var chrs = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
		count = 16,
		name = '';

	// Append a random character to the name
	while (count--) {
		name += chrs.charAt(Math.random() * 62 | 0);
	}

	return name;
};

// Export http utils
exports.http = require('./http');

// Log data on new connections
exports.log = function (host, connection) {

	var log = {},
		logger = host.logger;

	// Prepare log object
	Object.keys(connection).filter(function (attribute) {
		return typeof connection[attribute] !== 'function';
	}).forEach(function (attribute) {
		log[attribute] = connection[attribute];
	});

	// Apply the log object
	log = logger.callback(log);

	// Check if the logger has defined a result and write to stream
	if (log !== undefined) {

		// Stringify log data
		if (typeof log !== 'string') {
			log = JSON.stringify(log);
		}

		// Write the log on a new line in the host logger
		logger.stream.write(log + '\n');
	}
};

// Get the cookies of the request
exports.parseCookies = function (request) {

	var cookies = {},
		current = '',
		header = '',
		index = 0,
		name = '',
		value = '';

	// Check if the request has a cookie header
	if (request.headers.cookie) {
		header = request.headers.cookie;
	}

	// Get the first character
	current = header[0];

	// Populate cookies
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the name of the cookie
		while (current && current !== '=') {
			name += current;
			index++;
			current = header[index];
		}

		// Skip "="
		if (current === '=') {
			index++;
			current = header[index];
		}

		// Get the value of the cookie
		while (current && current !== ';') {
			value += current;
			index++;
			current = header[index];
		}

		// Set the current cookie and wait for the next one
		cookies[name] = decodeURIComponent(value);
		name = '';
		value = '';
		index++;
		current = header[index];
	}

	return cookies;
};

// Get the languages accepted by the client
exports.parseLangs = function (request) {

	var current = '',
		header = '',
		index = 0,
		langs = [],
		name = '',
		quality = '',
		ready = false;

	// Check if the request has an accept-language header
	if (request.headers['accept-language']) {
		header = request.headers['accept-language'];
	}

	// Get the first character
	current = header[0];

	// Populate langs
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the name of the language
		while (current && current !== ',' && current !== ';') {
			name += current;
			index++;
			current = header[index];
		}

		// Set the quality factor to 1 if none found or continue to get it
		if (!current || current === ',') {
			quality = '1';
			ready = true;
		} else if (current === ';') {
			index++;
			current = header[index];
		}

		// Check for quality factor
		if (!ready && header.substr(index, 2) === 'q=') {
			index += 2;
			current = header[index];
		}

		// Get the quality factor of the languages
		while (!ready && current && current !== ',') {
			quality += current;
			index++;
			current = header[index];
		}

		// Add the language to the set
		langs.push({
			name: name,
			quality: Number(quality)
		});

		// Reset flags and wait for the next language
		name = '';
		quality = '';
		ready = false;
		index++;
		current = header[index];
	}

	// Sort the languages in the order of their importance and return them
	return langs.sort(function (first, second) {
		return second.quality - first.quality;
	}).map(function (element) {
		return element.name;
	});
};

// Export the parsers
exports.parsers = {
	json: require('./parsers/json'),
	multipart: require('./parsers/multipart'),
	qs: require('./parsers/qs')
};

// Export ws utils
exports.ws = require('./ws');