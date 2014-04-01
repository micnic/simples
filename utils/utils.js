'use strict';

var crypto = require('crypto'),
	fs = require('fs'),
	stream = require('stream'),
	url = require('url');

// Utils namespace
var utils = exports;

// Check if the origin header is accepted by the host (CORS)
utils.accepts = function (host, connection) {

	var accepted = true,
		origin = connection.headers.origin,
		origins = host.conf.origins;

	// Get the hostname from the origin
	origin = url.parse(origin).hostname || origin;

	// Check if the origin is accepted
	if (origin && origin !== connection.host) {
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

	var config = host.conf.session;

	// Generate a random session id of 20 bytes
	crypto.randomBytes(20, function (error, buffer) {

		var id = buffer.toString('hex'),
			secret = Array.apply(null, buffer);

		// Check for error, which, eventually, should never happen(!)
		if (error) {
			console.error('\nsimpleS: can not generate random bytes');
			throw error;
		}

		// Sort randomly the bytes of the generated id
		secret.sort(function () {
			return 0.5 - Math.random();
		});

		// Set the id as a hex string
		secret = new Buffer(secret).toString('hex');

		// Generate the session hash
		utils.generateHash(id + secret, 'hex', function (hash) {
			callback(connection, {
				id: id,
				hash: hash,
				expires: config.timeout + Date.now(),
				container: {}
			});
		});
	});
};

// Generate the session container
utils.getSession = function (host, connection, callback) {

	var config = host.conf.session,
		cookies = connection.cookies;

	// Validate session cookies and get the session container
	if (cookies._session) {
		config.store.get(cookies._session, function (session) {
			if (session && session.hash === cookies._hash) {
				callback(connection, session);
			} else {
				utils.generateSession(host, connection, callback);
			}
		});
	} else {
		utils.generateSession(host, connection, callback);
	}
};

// Export http utils
utils.http = require('simples/utils/http');

// Log data on new connections
utils.log = function (host, connection) {

	var data = {},
		log = null,
		logger = host.logger;

	// Prepare source data object
	Object.keys(connection).filter(function (attribute) {
		return typeof connection[attribute] !== 'function';
	}).forEach(function (attribute) {
		data[attribute] = connection[attribute];
	});

	// Apply the data object
	log = logger.callback(data);

	// Write to the stream only if the logger has defined a result
	if (log !== undefined) {

		// Stringify log data
		if (typeof log !== 'string') {
			log = JSON.stringify(log, null, ' ');
		}

		// Write the log on a new line in the stream
		if (logger.stream.writable) {
			logger.stream.write(log + '\n');
		}
	}
};

// Get the cookies of the connection
utils.parseCookies = function (connection) {

	var cookies = {},
		current = '',
		header = '',
		index = 0,
		name = '',
		value = '';

	// Check if the connection has the cookie header
	if (connection.headers.cookie) {
		header = connection.headers.cookie;
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
utils.parseLangs = function (connection) {

	var current = '',
		header = '',
		index = 0,
		langs = [],
		name = '',
		quality = '',
		ready = false;

	// Check if the connection has the accept-language header
	if (connection.headers['accept-language']) {
		header = connection.headers['accept-language'];
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