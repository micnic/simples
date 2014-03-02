'use strict';

var crypto = require('crypto'),
	fs = require('fs'),
	session = require('simples/lib/session'),
	stream = require('stream'),
	url = require('url');

// Utils namespace
var utils = exports;

// Check if the origin header is accepted by the host (CORS)
utils.accepts = function (host, request) {

	var accepted = true,
		origin = request.headers.origin,
		origins = host.conf.origins;

	// Get the hostname from the origin
	origin = url.parse(origin).hostname || origin;

	// Check if the origin is accepted
	if (origin && origin !== request.headers.host.split(':')[0]) {
		if (origins.indexOf(origin) < 0) {
			accepted = origins[0] === '*';
		} else {
			accepted = origins[0] !== '*';
		}
	}

	return accepted;
};

// Create a new Buffer instance from a list of buffers
utils.buffer = function () {

	var args = Array.apply(null, arguments);

	return Buffer.concat(args.slice(0, -1), args[args.length - 1]);
};

// Copy configuration from one object to another
utils.copyConfig = function (destination, source, stop) {

	// Iterate through the source keys to copy them
	Object.keys(source).forEach(function (property) {

		var dtype = typeof destination[property],
			stype = typeof source[property],
			valid = dtype === stype;

		// Copy the property if it has the same type
		if (destination[property] === null || dtype !== 'object' && valid) {
			destination[property] = source[property];
		} else if (dtype === 'object' && valid && !stop) {
			utils.copyConfig(destination[property], source[property], true);
		}
	});
};

// Generate hash from data and send it to the callback
utils.generateHash = function (data, encoding, callback) {

	var hash = new Buffer(0);

	// Hash received data
	crypto.Hash('sha1').on('readable', function () {

		var chunk = this.read() || new Buffer(0);

		// Append data to the hash
		hash = utils.buffer(hash, chunk, hash.length + chunk.length);
	}).on('end', function () {
		callback(hash.toString(encoding));
	}).end(data);
};

// Generate session id and hash
utils.generateSession = function (host, connection, callback) {

	var config = host.conf.session,
		instance = new session(config.timeout);

	// Generate a random session id of 20 bytes
	crypto.randomBytes(20, function (error, buffer) {

		// Check for error, which, eventually, should never happen(!)
		if (error) {
			console.error('\nsimpleS: can not generate random bytes');
			throw error;
		}

		// Set session id and append the session container to the connection
		instance.id = buffer.toString('hex');
		host.sessions[instance.id] = instance;
		connection.session = instance.container;

		// Generate the session hash
		utils.generateHash(instance.id + config.secret, 'hex', function (hash) {
			instance.hash = hash;
			callback(connection, instance.id, instance.hash);
		});
	});
};

// Generate the session container
utils.getSession = function (host, connection, callback) {

	var cookies = connection.cookies;

	// Generate new session if it does not exist
	if (!cookies._session || !host.sessions[cookies._session]) {
		utils.generateSession(host, connection, callback);
	} else {
		if (host.sessions[cookies._session].hash !== cookies._hash) {
			delete host.sessions[cookies._session];
			utils.generateSession(host, connection, callback);
		} else {
			connection.session = host.sessions[cookies._session].container;
			host.sessions[cookies._session].update();
			callback(connection, cookies._session, cookies._hash);
		}
	}
};

// Export http utils
utils.http = require('simples/utils/http');

// Log data on new connections
utils.log = function (host, connection) {

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
utils.parseCookies = function (request) {

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
utils.parseLangs = function (request) {

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
utils.parsers = {
	json: require('simples/utils/parsers/json'),
	multipart: require('simples/utils/parsers/multipart'),
	qs: require('simples/utils/parsers/qs')
};

// Generate UTC string for a numeric time value
utils.utc = function (time) {
	return new Date(Date.now() + time).toUTCString();
};

// Export ws utils
utils.ws = require('simples/utils/ws');