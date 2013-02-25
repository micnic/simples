var events = require('events');
var fs = require('fs');

var mime = require('../utils/mime');

// Response interface prototype constructor
var responseInterface = module.exports = function (request, response, host) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Set response interface properties
	Object.defineProperties(this, {
		request: {
			value: request
		},
		response: {
			value: response
		},
		host: {
			value: host
		}
	});

	// Is a writable stream
	this.writable = true;

	// Emit events triggered by the response stream
	response.stream.on('close', function () {
		that.emit('close');
	});

	response.stream.on('drain', function () {
		that.emit('drain');
	});

	response.stream.on('end', function () {
		that.emit('end');
	});

	response.stream.on('error', function (error) {
		that.emit('error', error);
	});

	// Setting the default content type to html
	response.setHeader('Content-Type', 'text/html;charset=utf-8');
};

// Inherit from events.EventEmitter
responseInterface.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: responseInterface,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Set the cookie with specific options
responseInterface.prototype.cookie = function (name, value, attributes) {
	'use strict';

	// Initialize the cookie with a name and a value
	var cookie = name + '=' + encodeURIComponent(value);

	// Use the configuration object or an empty object
	attributes = attributes || {};

	// Use expires or max-age to set the expiration time of the cookie
	if (attributes.expires) {
		cookie += ';expires=' + new Date(attributes.expires).toUTCString();
	} else if (attributes.maxAge) {
		cookie += ';max-age=' + attributes.maxAge;
	}

	// Set the path from the configuration or use the root
	if (attributes.path) {
		cookie += ';path=';
		if (attributes.path.charAt(0) !== '/') {
			cookie += '/';
		}
		cookie += attributes.path;
	}

	// Set the domain, by default is the current host
	if (attributes.domain) {
		cookie += ';domain=' + attributes.domain;
	}

	// Set the secure flag of the cookie
	if (attributes.secure) {
		cookie += ';secure';
	}

	// Set the httpOnly flag of the cookie
	if (attributes.httpOnly) {
		cookie += ';httponly';
	}

	// Concatenate the value of the cookie with the previous Set-Cookie header
	var previous = this.response.getHeader('Set-Cookie')
	this.response.setHeader('Set-Cookie', previous + '\r' + cookie);

	return this;
};

// Write the content of a file to the response
responseInterface.prototype.drain = function (path) {
	'use strict';

	fs.createReadStream(path).pipe(this.response.stream);
};

// End response stream
responseInterface.prototype.end = function (data) {
	'use strict';

	// HEAD request should not have body
	if (this.request.method === 'HEAD') {
		this.response.end();
		return;
	}

	this.response.stream.end(data);
};

// Set the header of the response
responseInterface.prototype.header = function (name, value) {
	'use strict';

	this.response.setHeader(name, value);

	return this;
};

// Set the language of the content of the response
responseInterface.prototype.lang = function (lang) {
	'use strict';
	this.response.setHeader('Content-Language', lang);

	return this;
};

// Redirect the client to the specific path
responseInterface.prototype.redirect = function (path) {
	'use strict';
	this.response.writeHead(302, {
		'Location':	path
	});
	this.response.end();
};

// Set cookie expiration time in past to remove it
responseInterface.prototype.removeCookie = function (name) {
	'use strict';
	this.cookie(name, '', {
		expires: new Date().toUTCString()
	});

	return this;
};

// Renders from the template engine
responseInterface.prototype.render = function () {
	'use strict';

	// HEAD request should not have body
	if (this.request.method === 'HEAD') {
		this.response.end();
		return;
	}

	var data = this.host.render.apply(this.host.renderer, arguments);
	this.response.stream.end(data);
};

// Send preformatted data to the response stream
responseInterface.prototype.send = function (data) {
	'use strict';

	// HEAD request should not have body
	if (this.request.method === 'HEAD') {
		this.response.end();
		return;
	}

	// Transform data to Buffer and writes it to the stream
	if (!(data instanceof Buffer)) {

		// Stringify data if it is not a string
		if (typeof data !== 'string' && !(data instanceof String)) {
			data = JSON.stringify(data);
		}

		// Create the buffer from the string if it exists
		if (data) {
			data = Buffer(data);
		} else {
			data = Buffer(0);
		}
	}

	this.response.stream.end(data);
};

// Set the type of the content of the response
responseInterface.prototype.type = function (type, override) {
	'use strict';

	// By default use the mime types from the provided list
	if (!override) {
		type = mime[type] || mime['default'];
	}

	this.response.setHeader('Content-Type', type);

	return this;
};

// Write to response stream
responseInterface.prototype.write = function (data) {
	'use strict';

	// HEAD request should not have body
	if (this.request.method === 'HEAD') {
		return;
	}

	this.response.stream.write(data);
};