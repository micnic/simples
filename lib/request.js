var qs = require('querystring');
var url = require('url');

// Parse data sent via POST method
function parsePOST(request, that) {

	if (!request.headers['content-type']) {
		return;
	}

	var content = request.headers['content-type'];
	var index = 0;
	var currentChar;

	while (currentChar = content.charAt(index), currentChar === ' ') {
		index++;
	}

	if (!currentChar) {
		return;
	}

	var contentType = '';
	while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ';') {
		contentType += currentChar;
		index++;
	}

	if (contentType === 'multipart/form-data') {

		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === ';') {
			index++;
		}

		if (!currentChar) {
			return;
		}

		var buffer = '';
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== '=') {
			buffer += currentChar;
			index++;
		}

		if (buffer !== 'boundary' || !currentChar) {
			return;
		}

		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === '=') {
			index++;
		}

		if (!currentChar) {
			return;
		}

		var boundary = '';
		while (currentChar = content.charAt(index)) {
			boundary += currentChar;
			index++;
		}

		if (!boundary) {
			return;
		}

		content = that.body;
		index = 0;
		var boundaryLength = boundary.length;
		var filename;
		var name;
		var type;
		var tempIndex;
		var filecontent;
		while (content.substr(index, 4 + boundaryLength) === '--' + boundary + '\r\n') {
			index += 4 + boundaryLength;
			index = content.indexOf('name="', index) + 6;
			if (index < 6) {
				break;
			}
			name = content.substring(index, content.indexOf('"', index));
			index += name.length + 1;
			tempIndex = content.indexOf('filename="', index) + 10;
			filename = undefined;
			if (tempIndex >= 10) {
				filename = content.substring(tempIndex, content.indexOf('"', tempIndex));
				index += 11 + filename.length;
				index = content.indexOf('Content-Type: ', index) + 14;
				type = content.substring(index, content.indexOf('\r', index));
				index += type.length;
			}
			index += 4;
			filecontent = '';

			while (currentChar = content.charAt(index), content.substr(index, 4 + boundaryLength) !== '\r\n--' + boundary) {
				filecontent += currentChar;
				index++;
			}

			if (filename) {
				that.files[name] = {
					content: filecontent,
					filename: filename,
					type: type
				};
			} else {
				that.query[name] = filecontent;
			}
			index += 2;
		}
	} else {
		var POSTquery = qs.parse(that.body);
		for (var i in POSTquery) {
			that.query[i] = POSTquery[i];
		}
	}
}

// Request interface prototype constructor
var requestInterface = module.exports = function (request, response, host) {
	'use strict';

	// Shortcut to this context
	var that = this;

	var parsedCookies = parseCookies(request, host);

	var session = parsedCookies.session;

	// The content body of the request
	this.body = '';

	// The cookies provided by the client
	this.cookies = parsedCookies.cookies;

	// Files sent using POST method and multipart/form-data encoding
	this.files = {};

	// The headers of the request
	this.headers = request.headers;

	// The languages accepted by the client in the order of their importance
	this.langs = parseLangs(request);

	// The method of the request
	this.method = request.method;

	// The components of the request url
	this.url = url.parse(request.url, true);

	// The object containing queries from both GET and POST methods
	this.query = this.url.query;

	// Prepare the domain for the session
	var domain = request.headers.host;
	var index = domain.indexOf(':');
	if (index > 0) {
		domain = domain.substring(0, index);
	}
	if (domain === 'localhost') {
		domain = '';
	}

	// Returns an array of random number
	function randomChars() {
		var chars = [];
		var count = 16;
		var value;

		// Generate numbers in loop
		while (count--) {

			// Get a random value from 0 to 61
			value = Math.round(Math.random() * 61);

			// Prepare char code 0-9a-zA-Z
			value += value < 10 && 48 || value < 36 && 56 || 61;

			// Append the value to the chars array
			chars[chars.length] = value;
		}

		return chars;
	}

	// Removes the session from the host
	function sessionRemover() {
		delete host.sessions[session._name];
	}

	// Generate an empty session
	function generateSession() {

		// Generate the session only if it does not exist
		if (session) {
			return;
		}

		// Prepare the name for the session
		var name = String.fromCharCode.apply(null, randomChars());

		// Set up the session
		host.sessions[name] = session = {
			_name: name,
			_timeout: setTimeout(sessionRemover, 3600000)
		};
	}

	// Define the getter for the session
	Object.defineProperty(this, 'session', {
		enumerable: true,
		get: function () {

			// Generate session if it does not exist
			generateSession();

			// Set up the cookie for the session and write it to the response
			var sessionTimeToLive = new Date(new Date().valueOf() + 3600000);
			var sessionCookie = '_session=' + session._name;
			sessionCookie += ';expires=' + sessionTimeToLive.toUTCString();
			sessionCookie += ';path=/;domain=' + domain + ';httponly';
			response.setHeader('Set-Cookie', sessionCookie);
			clearTimeout(session._timeout);
			session._timeout = setTimeout(sessionRemover, 3600000);

			return session;
		}
	});

	// Only for POST requests populate the body, the files and the query
	if (request.method === 'POST') {

		// Wait for string data from the request
		request.setEncoding('utf8');

		// Populate the body of the request
		request.on('data', function (data) {
			that.body += data;
		});

		// Populate the files and the query
		request.on('end', function () {
			parsePOST(request, that);
		});
	}
};

// Get the cookies and the session
var parseCookies = module.exports.parseCookies = function (request, host) {
	var cookies = {};
	var session = null;

	// Populate cookies and session
	if (request.headers.cookie) {
		var content = request.headers.cookie;
		var currentChar;
		var index = 0;
		while (currentChar = content.charAt(index)) {
			while (currentChar = content.charAt(index), currentChar === ' ') {
				index++;
			}
			if (!currentChar) {
				break;
			}
			var name = '';
			while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== '=') {
				name += currentChar;
				index++;
			}
			if (!currentChar) {
				break;
			}
			while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === '=') {
				index++;
			}
			if (!currentChar) {
				break;
			}
			var value = '';
			while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ';') {
				value += currentChar;
				index++;
			}
			value = decodeURIComponent(value);
			if (name === '_session') {
				session = host.sessions[value];
			} else {
				cookies[name] = value;
			}
			index++;
		}
	}

	return {
		cookies: cookies,
		session: session
	}
};

// Get the languages accepted by the client
var parseLangs = module.exports.parseLangs = function (request) {

	// Return an empty array if no accept language header
	if (!request.headers['accept-language']) {
		return [];
	}

	var content = request.headers['accept-language'];
	var currentChar;
	var index = 0;
	var lang;
	var langs = [];
	var quality;
	while (currentChar = content.charAt(index)) {
		lang = '';
		quality = '';
		while (currentChar = content.charAt(index), currentChar === ' ') {
			index++;
		}
		if (!currentChar) {
			break;
		}
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ',' && currentChar !== ';') {
			lang += currentChar;
			index++;
		}
		index++;
		if (!currentChar || currentChar === ',') {
			langs.push({
				lang: lang,
				quality: 1
			});
			continue;
		}
		while (currentChar = content.charAt(index), currentChar === ' ') {
			index++;
		}
		if (currentChar !== 'q') {
			break;
		}
		index++;
		while (currentChar = content.charAt(index), currentChar === ' ' || currentChar === '=') {
			index++;
		}
		if (!currentChar) {
			break;
		}
		while (currentChar = content.charAt(index), currentChar && currentChar !== ' ' && currentChar !== ',') {
			quality += currentChar;
			index++;
		}
		langs.push({
			lang: lang,
			quality: Number(quality)
		});
		index++;
	}

	langs = langs.sort(function (first, second) {
		return second.quality - first.quality;
	});

	var index = langs.length;

	while (index--) {
		langs[index] = langs[index].lang;
	}

	return langs;
};