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
		if (host.conf.origins.indexOf(origin) < 0) {
			accepted = host.conf.origins[0] === '*';
		} else {
			accepted = host.conf.origins[0] !== '*';
		}
	}

	return accepted;
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

// Get sessions from file and activate them in the hosts
exports.getSessions = function (instance, callback) {

	// Read and parse the sessions file
	fs.readFile('.sessions', 'utf8', function (error, data) {

		// Catch error at reading
		if (error) {
			callback();
			return;
		}

		// Supervise session file parsing
		try {
			data = JSON.parse(data);
		} catch (error) {
			console.error('\nsimpleS: can not parse sessions file');
			console.error(error.message + '\n');
		}

		// If data was not parsed
		if (typeof data === 'string') {
			callback();
			return;
		}

		// Activate the sessions from the file
		Object.keys(instance.hosts).forEach(function (host) {
			instance.hosts[host].sessions = data[host];

			Object.keys(data[host]).forEach(function (timer) {
				instance.hosts[host].timers[timer] = setTimeout(function () {
					delete instance.hosts[host].sessions[timer];
					delete instance.hosts[host].timers[timer];
				}, 3600000);
			});
		});

		// Continue to port listening
		callback();
	});
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
		if (name === '_session') {
			Object.defineProperty(cookies, '_session', {
				value: value
			});
		} else {
			cookies[name] = value;
		}
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

// Get the sessions from the hosts and save them to file
exports.saveSessions = function (instance, callback) {

	// Sessions container
	var sessions = {};

	// Select and deactivate sessions
	Object.keys(instance.hosts).forEach(function (host) {
		Object.keys(instance.hosts[host].timers).forEach(function (timer) {
			clearTimeout(instance.hosts[host].timers[timer]);
		});
		instance.hosts[host].timers = {};
		sessions[host] = instance.hosts[host].sessions;
	});

	// Prepare sessions for writing on file
	sessions = JSON.stringify(sessions);

	// Write the sessions in the file
	fs.writeFile('.sessions', sessions, 'utf8', function (error) {

		// Release the server in all cases
		instance.server.emit('release', callback);

		// Log the error
		if (error) {
			console.error('\nsimpleS: Can not write sessions to file\n');
			console.error(error.message + '\n');
			return;
		}

		// Lot the sessions file creation
		console.log('\nsimpleS: File with sessions created\n');
	});
};