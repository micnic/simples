'use strict';

var crypto = require('crypto'),
	url = require('url');

// Utils namespace
var utils = exports;

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
		throw TypeError('Cannot convert first argument to object');
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

// Emit safely errors to avoid fatal errors
utils.emitError = function (emitter, error) {
	if (emitter.listeners('error').length) {
		emitter.emit('error', error);
	} else if (process.stderr.isTTY) {
		// eslint-disable-next-line
		console.error('\n' + error.stack + '\n');
	}
};

// Generate hash from data and send it to the callback
utils.generateHash = function (data, encoding, callback) {

	var hash = Buffer(0);

	// Hash received data
	crypto.Hash('sha1').on('readable', function () {

		var chunk = this.read() || Buffer(0);

		// Append data to the hash
		hash = Buffer.concat([hash, chunk], hash.length + chunk.length);
	}).on('end', function () {
		callback(hash.toString(encoding));
	}).end(data);
};

// Generate session id and hash
utils.generateSession = function (host, callback) {

	var config = host.options.session,
		source = Buffer(32);

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

// Generate non-cryptographically strong pseudo-random data
utils.randomBytes = function (length, encoding) {

	var result = Buffer(length);

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

// Run the function in the provided context with the context as argument
utils.runFunction = function (fn, context) {
	if (typeof fn === 'function') {
		fn.call(context, context);
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