'use strict';

var crypto = require('crypto'),
	url = require('url');

// Utils namespace
var utils = exports;

// Export abstract connection prototype constructor
utils.connection = require('simples/lib/connection');

// Export http utils
utils.http = require('simples/utils/http');

// Export ws utils
utils.ws = require('simples/utils/ws');

// Check if the origin header is accepted by the host (CORS)
utils.accepts = function (connection, origins) {

	var accepted = true,
		origin = connection.headers.origin;

	// Get the hostname from the origin
	origin = url.parse(origin || '').hostname || origin;

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

// Partial polyfill for ES6 Object.assign
utils.assign = function (target, source) {

	// Check if the source is an object and copy its properties
	if (utils.isObject(source)) {
		Object.keys(source).forEach(function (key) {
			target[key] = source[key];
		});
	}

	return target;
};

// Copy configuration from one object to another
utils.copyConfig = function (destination, config, stop) {

	// Iterate through the config keys to copy them
	Object.keys(config).forEach(function (property) {

		var object = utils.isObject(destination[property]),
			valid = typeof destination[property] === typeof config[property];

		// Copy the property if it has the same type
		if (object && valid && !stop) {
			utils.copyConfig(destination[property], config[property], true);
		} else if (destination[property] === null || !object && valid) {
			if (typeof destination[property] === 'string') {
				destination[property] = config[property].toLowerCase();
			} else {
				destination[property] = config[property];
			}
		}
	});
};

// Emit safely errors to avoid fatal errors
utils.emitError = function (emitter, error) {
	if (emitter.listeners('error').length) {
		emitter.emit('error', error);
	} else if (process.stdout.isTTY) {
		console.error('\n' + error.stack + '\n');
	}
};

// Generate hash from data and send it to the callback
utils.generateHash = function (data, encoding, callback) {

	var hash = new Buffer(0);

	// Hash received data
	crypto.Hash('sha1').on('readable', function () {

		var chunk = this.read() || new Buffer(0);

		// Append data to the hash
		hash = Buffer.concat([hash, chunk], hash.length + chunk.length);
	}).on('end', function () {
		callback(hash.toString(encoding));
	}).end(data);
};

// Generate session id and hash
utils.generateSession = function (host, connection, callback) {

	var config = host.options.session,
		secret,
		source = new Buffer(32);

	// Generate a random session id of 16 bytes
	crypto.randomBytes(16, function (error, buffer) {
		if (error) {
			utils.emitError(host, error);
		} else {

			// Create the source from which to generate the hash
			secret = new Buffer(utils.toArray(buffer).sort(utils.shuffle));
			buffer.copy(source);
			secret.copy(source, 16);

			// Generate the session hash
			utils.generateHash(source, 'hex', function (hash) {
				callback(connection, {
					id: buffer.toString('hex'),
					hash: hash,
					expires: config.timeout + Date.now(),
					container: {}
				});
			});
		}
	});
};

// Get an existing stored session or generate a new one
utils.getSession = function (host, connection, callback) {

	var config = host.options.session,
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

// Check for an object value
utils.isObject = function (value) {
	return Object.prototype.toString.call(value) === '[object Object]';
};

// Apply a map operation on an object
utils.map = function (object, callback) {
	return Object.keys(object).map(callback);
};

// Get the cookies of the request
utils.parseCookies = function (header) {

	var cookies = {},
		current = header[0],
		index = 0,
		length = 0,
		name = '',
		value = '';

	// Populate cookies
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the length of the name of the cookie
		while (current && current !== '=') {
			length++;
			current = header[index + length];
		}

		// Get the name of the cookie
		name = header.substr(index, length).trim();

		// Set the new index and reset length
		index += length;
		length = 0;

		// Skip "="
		if (current === '=') {
			index++;
			current = header[index];
		}

		// Get the length of the value of the cookie
		while (current && current !== ';') {
			length++;
			current = header[index + length];
		}

		// Get the value of the cookie
		value = decodeURIComponent(header.substr(index, length).trim());

		// Set the current cookie
		cookies[name] = value;

		// Prepare for the next cookie
		index += length + 1;
		length = 0;
		name = '';
		value = '';
		current = header[index];
	}

	return cookies;
};

// Get the languages accepted by the client
utils.parseLangs = function (header) {

	var current = header[0],
		index = 0,
		langs = [],
		length = 0,
		name = '',
		quality = '';

	// Populate langs
	while (current) {

		// Skip whitespace
		while (current === ' ') {
			index++;
			current = header[index];
		}

		// Get the length of the name of the language
		while (current && current !== ',' && current !== ';') {
			length++;
			current = header[index + length];
		}

		// Get the name of the language
		name = header.substr(index, length);

		// Set the new index and reset length
		index += length;
		length = 0;

		// Set the quality factor to 1 if none found or continue to get it
		if (!current || current === ',') {
			quality = '1';
		} else if (current === ';') {
			index++;
			current = header[index];
		}

		// Check for quality factor
		if (!quality && header.substr(index, 2) === 'q=') {
			index += 2;
			current = header[index];
		}

		// Get the length of the quality factor of the language
		while (!quality && current && current !== ',') {
			length++;
			current = header[index + length];
		}

		// Get the quality factor of the language
		if (!quality) {
			quality = header.substr(index, length);
		}

		// Add the current language to the set
		langs.push({
			name: name,
			quality: Number(quality)
		});

		// Prepare for the next language
		index += length + 1;
		length = 0;
		name = '';
		quality = '';
		current = header[index];
	}

	// Sort the languages in the order of their importance and return them
	return langs.sort(function (first, second) {
		return second.quality - first.quality;
	}).map(function (lang) {
		return lang.name;
	});
};

// Generate non-cryptographically strong pseudo-random data
utils.randomBytes = function (count, encoding) {

	var value = new Buffer(randomBytesArray());

	// Generate an array with random 0-255 values
	function randomBytesArray() {
		return Array.apply(Array, new Array(count)).map(function () {
			return Math.round(Math.random() * 255);
		});
	}

	// Check if the encoding is defined and apply it
	if (encoding) {
		value = value.toString(encoding);
	}

	return value;
};

// Run the callback if it is a function
utils.runFunction = function (callback) {
	if (typeof callback === 'function') {
		callback();
	}
};

// Set options for client request instances
utils.setOptions = function (instance, options) {

	// Change an option with a defined value
	function setOption(name, value) {
		if (value !== undefined) {
			instance.options[name] = value;
		}
	}

	// Set options only from an object container
	if (typeof options === 'object') {
		setOption('agent', options.agent);
		setOption('auth', options.auth);
		setOption('ca', options.ca);
		setOption('cert', options.cert);
		setOption('ciphers', options.ciphers);
		setOption('headers', options.headers);
		setOption('key', options.key);
		setOption('passphrase', options.passphrase);
		setOption('pfx', options.pfx);
		setOption('rejectUnauthorized', options.rejectUnauthorized);
		setOption('secureProtocol', options.secureProtocol);
	}
};

// Write the session to the host storage
utils.setSession = function (host, connection, session) {

	var config = host.options.session;

	// Write the session object and remove its reference inside the connection
	config.store.set(session.id, {
		id: session.id,
		hash: session.hash,
		expire: config.timeout * 1000 + Date.now(),
		container: connection.session
	}, function () {
		connection.session = null;
	});
};

// Returns a random value from -0.5 to 0.5
utils.shuffle = function () {
	return 0.5 - Math.random();
};

// Transform an object to an array
utils.toArray = function (object) {
	return Array.prototype.slice.call(object, 0);
};

// Generate UTC string for a numeric time value
utils.utc = function (time) {
	return new Date(Date.now() + time).toUTCString();
};

// Apply a xor mask on a buffer
utils.xor = function (buffer, mask) {

	var index = buffer.length,
		length = mask.length;

	// Loop through the buffer and apply xor
	while (index--) {
		buffer[index] ^= mask[index % length];
	}
};