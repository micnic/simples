var events = require('events');
var fs = require('fs');

// Get mime types
var mimeTypes = JSON.parse(fs.readFileSync(__dirname + '/../utils/mime.json', 'utf8'));

// Response interface prototype constructor
var responseInterface = module.exports = function (request, response, stream, server) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Linking the response and the stream
	Object.defineProperties(this, {
		request: {
			value: request
		},
		response: {
			value: response
		},
		server: {
			value: server
		},
		stream: {
			value: stream
		}
	});

	// Can be used as a writable stream
	this.writable = true;

	// Emit events triggered by the response stream
	stream.on('close', function () {
		that.emit('close');
	});

	stream.on('drain', function () {
		that.emit('drain');
	});

	stream.on('end', function () {
		that.emit('end');
	});

	stream.on('error', function (error) {
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

// Set the cookie with specific options (expires, max-age, path, domain, secure, httponly)
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

	// For future https implementation
	/*if (attributes.secure) {
		cookie += ';secure';
	}*/

	// Set the httpOnly flag of the cookie
	if (attributes.httpOnly) {
		cookie += ';httponly';
	}

	// Concatenate the value of the cookie with the Set-Cookie header delimiting them with \r
	this.response.setHeader('Set-Cookie', this.response.getHeader('Set-Cookie') + '\r' + cookie);
};

// End response stream
responseInterface.prototype.end = function (data) {
	'use strict';

	// HEAD request should not have body
	if (this.request.method === 'HEAD') {
		this.response.end();
		return;
	}

	this.stream.end(data);
};

// Set the language of the content of the response
responseInterface.prototype.lang = function (lang) {
	'use strict';
	this.response.setHeader('Content-Language', lang);
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
};

// Renders from the 
responseInterface.prototype.render = function () {
	'use strict';
	var data = this.server.render.apply(this.server.engine, arguments);
	this.stream.end(data);
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
		if (typeof data !== 'string' && !(data instanceof String)) {
			data = JSON.stringify(data);
		}

		data = new Buffer(data);
	}

	this.stream.write(data);
	this.stream.end();
};

// Set the type of the content of the response
responseInterface.prototype.type = function (type, override) {
	'use strict';

	// By default use the mime types from the provided list
	if (!override) {
		type = mimeTypes[type] || mimeTypes['default'];
	}

	this.response.setHeader('Content-Type', type);
};

// Write to response stream
responseInterface.prototype.write = function (data) {
	'use strict';

	// HEAD request should not have body
	if (this.request.method === 'HEAD') {
		return;
	}

	this.stream.write(data);
};

// Make public the mime types
module.exports.mimeTypes = mimeTypes;