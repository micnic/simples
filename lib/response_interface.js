var mime = require('./mime');

function responseInterface(responseStream) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof responseInterface)) {
		return new responseInterface(responseStream);
	}

	// Linking the response and the stream
	this._response = responseStream.response;
	this._stream = responseStream;

	// Setting the default content type to html
	this._response.setHeader('Content-Type', 'text/html;charset=utf-8');
}

// Set the cookie with specific options (expires, max-age, path, domain, secure, httponly)
responseInterface.prototype.cookie = function (name, value, config) {
	var cookie = name + '=' + value;

	if (config) {
		if (config.expires) {
			cookie += ';expires=' + new Date(config.expires).toUTCString();
		}

		if (config.maxAge) {
			cookie += ';max-age=' + config.maxAge;
		}

		if (config.path) {
			cookie += ';path=' + config.path;
		} else {
			cookie += ';path=' + '/';
		}

		if (config.domain) {
			cookie += ';domain=' + config.domain;
		} else {
			cookie += ';domain=' + request.headers['host'];
		}

		// For future https implementation
		if (config.secure) {
			cookie += ';secure';
		}

		if (config.httpOnly) {
			cookie += ';httponly';
		}
	}

	if (this._response.getHeader('Set-Cookie')) {
		this._response.setHeader('Set-Cookie', this._response.getHeader('Set-Cookie') + '\r' + cookie);
	} else {
		this._response.setHeader('Set-Cookie', cookie);
	}
};

// Force to download the file
responseInterface.prototype.download = function (filename) {
	this._response.setHeader('Content-Disposition', 'attachment;filename=' + '"' + filename + '"');
	this._response.end();
};

// End response stream
responseInterface.prototype.end = function (data) {
	if (data) {
		this.write(data);
	}
	this._stream.end();
};

// Set the language of the content of the response
responseInterface.prototype.lang = function (lang) {
	this._response.setHeader('Content-Language', lang);
};

// Redirect the client
responseInterface.prototype.redirect = function (path) {
	this._response.writeHead(302, {
		'Location':	path
	});
	this._response.end();
};

// Set cookie expiration time in past
responseInterface.prototype.removeCookie = function (name) {
	this.cookie(name, '', {
		expires: new Date().toUTCString()
	});
};

// Set the type of the content of the response
responseInterface.prototype.type = function (type) {
	this._response.setHeader('Content-Type', mime(type));
};

// Write to response stream
responseInterface.prototype.write = function (data) {
	this._stream.write(data);
};

module.exports = responseInterface;