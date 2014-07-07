'use strict';

var crypto = require('crypto'),
	fs = require('fs'),
	stream = require('stream'),
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

// RegExp to replace star wildcard
utils.allPatternRegExp = /\*/gi;

// RegExp to escape all special characters
utils.escapeRegExp = /[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/gi;

// RegExp to match named parameters
utils.paramsRegExp = /:([^\\.]+)/gi;

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

		var cproperty = config[property],
			dproperty = destination[property],
			object = utils.isObject(dproperty),
			valid = !stop && typeof dproperty === typeof cproperty;

		// Copy the property if it has the same type
		if (object && valid) {
			utils.copyConfig(dproperty, cproperty, true);
		} else if (dproperty === null || valid) {
			destination[property] = cproperty;
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
		hash = Buffer.concat([hash, chunk], hash.length + chunk.length);
	}).on('end', function () {
		callback(hash.toString(encoding));
	}).end(data);
};

// Generate session id and hash
utils.generateSession = function (host, connection, callback) {

	var config = host.conf.session;

	// Generate a random session id of 16 bytes
	crypto.randomBytes(16, function (error, buffer) {

		var id = buffer.toString('hex'),
			secret = Array.apply(Array, buffer);

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

// Check for a plain object
utils.isObject = function (object) {

	var prototype = Object.prototype.toString;

	return prototype.call(object) === '[object Object]';
};

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

// Generate UTC string for a numeric time value
utils.utc = function (time) {
	return new Date(Date.now() + time).toUTCString();
};