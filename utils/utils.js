'use strict';

var crypto = require('crypto'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	url = require('url');

// Utils namespace
var utils = exports;

// Export abstract connection prototype constructor
utils.Connection = require('simples/lib/connection');

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

// Temporary Object.assign polyfill to be used until V8 fully supports ES6
utils.assign = function (target) {

	if (target === undefined || target === null) {
		throw new TypeError('Cannot convert first argument to object');
	}

	var to = Object(target);
	for (var i = 1; i < arguments.length; i++) {
		var nextSource = arguments[i];
		if (nextSource === undefined || nextSource === null) {
			continue;
		}
		nextSource = Object(nextSource);

		var keysArray = Object.keys(nextSource);
		for (var j = 0, len = keysArray.length; j < len; j++) {
			var nextKey = keysArray[j];
			var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
			if (desc !== undefined && desc.enumerable) {
				to[nextKey] = nextSource[nextKey];
			}
		}
	}
	return to;
};

// Create internal instances for servers and mirrors
utils.createInstance = function (server, options) {

	var config = {},
		instance = null;

	// Prepare the internal instance
	if (options.https) {
		try {

			// Prepare TLS configuration
			Object.keys(options.https).forEach(function (option) {
				if (/^(?:cert|key|pfx)$/.test(option)) {
					config[option] = fs.readFileSync(options.https[option]);
				} else {
					config[option] = options.https[option];
				}
			});

			// Create a HTTPS server and apply the TLS configuration
			instance = https.Server(config);
		} catch (error) {
			server.emit('error', error);
		}
	} else {
		instance = http.Server();
	}

	// Transfer the error event from the internal instance to the server
	instance.on('error', function (error) {
		server.busy = false;
		server.started = false;
		server.emit('error', error);
	});

	return instance;
};

// Emit safely errors to avoid fatal errors
utils.emitError = function (emitter, error) {
	if (emitter.listeners('error').length) {
		emitter.emit('error', error);
	} else if (process.stderr.isTTY) {
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
utils.generateSession = function (host, callback) {

	var config = host.options.session,
		source = new Buffer(32);

	// Generate a random session id of 16 bytes
	crypto.randomBytes(16, function (error, buffer) {
		if (error) {
			utils.emitError(host, error);
		} else {

			// Create the source from which to generate the hash
			buffer.copy(source);
			utils.shuffle(buffer).copy(source, 16);

			// Generate the session hash
			utils.generateHash(source, 'hex', function (hash) {
				callback({
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
				callback(session);
			} else {
				utils.generateSession(host, callback);
			}
		});
	} else {
		utils.generateSession(host, callback);
	}
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
utils.randomBytes = function (length, encoding) {

	var result = new Buffer(length);

	// Fill the result with random 0-255 values
	while (length) {
		result[length] = Math.round(Math.random() * 255);
		length--;
	}

	// Check if the encoding is defined and apply it
	if (encoding) {
		result = result.toString(encoding);
	}

	return result;
};

// Run the callback if it is a function
utils.runFunction = function (callback) {
	if (typeof callback === 'function') {
		callback.apply(null, Array.prototype.slice.call(arguments, 1));
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

// Shuffle the data in a buffer and return that buffer
utils.shuffle = function (buffer) {
	return Array.prototype.sort.call(buffer, function () {
		return 0.5 - Math.random();
	});
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