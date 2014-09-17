'use strict';

var crypto = require('crypto'),
	url = require('url');

// Utils namespace
var utils = exports;

// Export abstract connection prototype constructor
utils.connection = require('simples/lib/connection');

// Export http utils
utils.http = require('simples/utils/http');

// Export the parsers
utils.parsers = {
	json: require('simples/utils/parsers/json'),
	multipart: require('simples/utils/parsers/multipart'),
	qs: require('simples/utils/parsers/qs')
};

// Export ws utils
utils.ws = require('simples/utils/ws');

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
			destination[property] = config[property];
		}
	});
};

// Emit safely errors to avoid fatal errors
utils.emitError = function (emitter, error, log) {
	if (emitter.listeners('error').length) {
		emitter.emit('error', error);
	} else if (log) {
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

	var config = host.conf.session;

	// Process the buffer of random bytes and prepare hashes for the session
	function prepareSessionHashes(buffer) {

		var id = buffer.toString('hex'),
			secret = Array.apply(Array, buffer);

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
	}

	// Generate a random session id of 16 bytes
	crypto.randomBytes(16, function (error, buffer) {
		if (error) {
			utils.emitError(host, error, true);
		} else {
			prepareSessionHashes(buffer);
		}
	});
};

// Get an existing stored session or generate a new one
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

// Check for a plain object
utils.isObject = function (object) {

	var prototype = Object.prototype.toString;

	return prototype.call(object) === '[object Object]';
};

// Write the session to the host storage
utils.setSession = function (host, connection, session) {

	var config = host.conf.session;

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

// Generate UTC string for a numeric time value
utils.utc = function (time) {
	return new Date(Date.now() + time).toUTCString();
};