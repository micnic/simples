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

	var log = {};

	// Prepare log object
	Object.keys(connection).filter(function (attribute) {
		return typeof connection[attribute] !== 'function';
	}).forEach(function (attribute) {
		log[attribute] = connection[attribute];
	});

	// Apply the log object
	log = host.logger.callback(log);

	// Check if the logger has defined a result and write to stream
	if (log !== undefined) {

		// Stringify log data
		if (typeof log !== 'string') {
			log = JSON.stringify(log);
		}

		host.logger.stream.write(log + '\n');
	}
};

// Get the cookies and the session
exports.parseCookies = function (content) {

	var cookies = {},
		currentChar = content.charAt(0),
		index = 0,
		name,
		value;

	// Populate cookies and session
	while (currentChar) {
		while (currentChar === ' ') {
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar) {
			break;
		}
		name = '';
		while (currentChar && currentChar !== ' ' && currentChar !== '=') {
			name += currentChar;
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar) {
			break;
		}
		while (currentChar === ' ' || currentChar === '=') {
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar) {
			break;
		}
		value = '';
		while (currentChar && currentChar !== ' ' && currentChar !== ';') {
			value += currentChar;
			index++;
			currentChar = content.charAt(index);
		}
		value = decodeURIComponent(value);
		cookies[name] = value;
		index++;
		currentChar = content.charAt(index);
	}

	return cookies;
};

// Get the languages accepted by the client
exports.parseLangs = function (content) {

	var currentChar = content.charAt(0),
		index = 0,
		lang,
		langs = [],
		quality;

	// Start parsing
	while (currentChar) {
		lang = '';
		quality = '';
		while (currentChar === ' ') {
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar) {
			break;
		}
		while (currentChar && currentChar !== ' ' && currentChar !== ',' && currentChar !== ';') {
			lang += currentChar;
			index++;
			currentChar = content.charAt(index);
		}
		if (!currentChar || currentChar === ',') {
			langs.push({
				lang: lang,
				quality: 1
			});
		} else {
			index++;
			currentChar = content.charAt(index);
			while (currentChar === ' ') {
				index++;
				currentChar = content.charAt(index);
			}
			if (currentChar !== 'q') {
				break;
			}
			index++;
			while (currentChar === ' ' || currentChar === '=') {
				index++;
				currentChar = content.charAt(index);
			}
			if (!currentChar) {
				break;
			}
			while (currentChar && currentChar !== ' ' && currentChar !== ',') {
				quality += currentChar;
				index++;
				currentChar = content.charAt(index);
			}
			langs.push({
				lang: lang,
				quality: Number(quality)
			});
		}
		index++;
		currentChar = content.charAt(index);
	}

	// Sort the languages in the order of their importance and return them
	return langs.sort(function (first, second) {
		return second.quality - first.quality;
	}).map(function (element) {
		return element.lang;
	});
};

// Export ws utils
exports.ws = require('./ws');