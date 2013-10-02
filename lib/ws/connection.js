'use strict';

var events = require('events'),
	url = require('url'),
	utils = require('../../utils/utils');

// WS connection prototype constructor
var connection = function (host, config, request) {

	var cookies,
		langs,
		hostname,
		protocol,
		session,
		socket = request.connection;

	// Getter for cookies
	function getCookies() {

		// Parse cookies
		if (!cookies && request.headers.cookie) {
			cookies = utils.parseCookies(request.headers.cookie);
		}

		cookies = cookies || {};

		return cookies;
	}

	// Getter for accepted language
	function getLangs() {

		// Parse languages
		if (!langs && request.headers['accept-language']) {
			langs = utils.parseLangs(request.headers['accept-language']);
		}

		return langs || [];
	}

	// Getter for session
	function getSession() {

		// Parse cookies
		if (!cookies && request.headers.cookie) {
			cookies = utils.parseCookies(request.headers.cookie);
		} else {
			cookies = {};
		}

		// Write session if it is not defined
		if (!session) {
			session = cookies._session;
		}

		return host.sessions[session];
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Get the protocol
	if (socket.encrypted) {
		protocol = 'wss://';
	} else {
		protocol = 'ws://';
	}

	// Prepare host name
	if (request.headers.host) {
		hostname = request.headers.host;
	} else {
		hostname = 'main';
	}

	// The headers of the handshake HTTP request
	this.headers = request.headers;

	// The remote address of the request
	this.ip = socket.remoteAddress;

	// The protocols used in WS context
	this.protocols = request.headers['sec-websocket-protocol'].split(/,\s*/);

	// The components of the request url
	this.url = url.parse(protocol + hostname + request.url, true);

	// The hostname from the host header
	this.host = this.url.hostname;

	// The object containing queries from the handshake HTTP request
	this.query = this.url.query;

	// The pathname of the url of the request
	this.path = this.url.pathname;

	// The protocol of the request
	this.protocol = protocol.slice(0, -3);

	// Render from the template engine SHOULD BE ONLY FOR RAW MODE
	this.render = function (event, source, imports) {

		// Prepare data
		if (this.config.rawMode) {
			source = event;
			imports = source;
		}

		// Inject connection to imports
		imports = imports || {};
		imports.connection = this;

		// Check from raw or advanced mode
		if (this.config.rawMode) {
			this.send(host.render(source, imports));
		} else {
			this.send(event, host.render(source, imports));
		}
	};

	// Define special properties for the WS connection
	Object.defineProperties(this, {
		config: {
			value: config,
			writable: true
		},
		cookies: {
			enumerable: true,
			get: getCookies
		},
		langs: {
			enumerable: true,
			get: getLangs
		},
		session: {
			enumerable: true,
			get: getSession
		},
		socket: {
			value: socket
		}
	});

	// Make it possible to bind to more than 10 channels
	this.setMaxListeners(0);
};

// Inherit from events.EventEmitter
connection.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: connection
	}
});

// Close the connection
connection.prototype.close = function () {
	this.socket.end(new Buffer([136, 0]));
	this.emit('close');
};

// Send data to the client
connection.prototype.send = function (event, data) {

	var header,
		length,
		queue = new Buffer(0),
		type = 2;

	// Prepare data
	if (this.config.rawMode) {
		data = event;
	} else {
		data = {
			binary: data instanceof Buffer,
			event: event,
			data: data
		};
	}

	// Data type, may be binary or text
	if (!(data instanceof Buffer)) {

		// Stringify data which is not string
		if (typeof data !== 'string') {
			data = JSON.stringify(data);
		}

		data = new Buffer(data || 0);
		type = 1;
	}

	// Cache data length
	length = data.length;

	// Prepare data which is bigger that 16kB
	if (length > 65535) {

		// Prepare the first 64kB frame
		header = new Buffer([type, 126, 255, 255]);
		queue = utils.buffer(queue, header, data.slice(0, 65535), 65539);
		data = data.slice(65535);
		length = data.length;
		type = 0;

		// Prepare the next 64kB frames
		while (length > 65535) {
			header = new Buffer([0, 126, 255, 255]);
			length = queue.length + 65539;
			queue = utils.buffer(queue, header, data.slice(0, 65535), length);
			data = data.slice(65535);
			length = data.length;
		}
	}

	// Prepare the last frame or the only frame depending on its length
	if (length < 126) {
		header = new Buffer([128 | type, length]);
	} else {
		header = new Buffer([128 | type, 126, 255 & length >> 8, 255 & length]);
	}

	// Concatenate data and, it to the queue and write to the socket
	length = queue.length + header.length + data.length;
	queue = utils.buffer(queue, header, data, length);
	this.socket.write(queue);
};

module.exports = connection;