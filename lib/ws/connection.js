'use strict';

var events = require('events'),
	url = require('url'),
	utils = require('../../utils/utils');

// WebSocket connection prototype constructor
var connection = function (host, config, request) {

	var cookies,
		langs,
		protocol,
		session,
		socket = request.connection,
		that = this;

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
		}

		cookies = cookies || {};

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

	// The headers of the handshake HTTP request
	this.headers = request.headers;

	// The remote address of the request
	this.ip = socket.remoteAddress;

	// The protocols used in WebSocket context
	this.protocols = request.headers['sec-websocket-protocol'].split(/,\s*/);

	// The components of the request url
	this.url = url.parse(protocol + host.parent.name + request.url, true);

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
		if (this.config.raw) {
			source = event;
			imports = source;
		}

		imports = imports || {};
		imports.connection = this;

		// Check from raw or advanced mode
		if (this.config.raw) {
			this.send(host.render(source, imports));
		} else {
			this.send(event, host.render(source, imports));
		}
	};

	// Define special properties for WebSocket connection
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
		queue: {
			value: new Buffer(0),
			writable: true
		},
		sending: {
			value: false,
			writable: true
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
		that = this,
		type = 2;

	// Prepare data
	if (this.config.raw) {
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

	// Get the first frames
	while (length > 65535) {
		header = new Buffer([type, 126, 255, 255]);
		type = 0;
		length = this.queue.length + 65539;
		this.queue = utils.buffer(this.queue, header, data.slice(0, 65535), length);
		data = data.slice(65535);
		length = data.length;
	}

	// Get the last frame or the only frame depending on its length
	if (length < 126) {
		header = new Buffer([128 | type, length]);
	} else {
		header = new Buffer([128 | type, 126, 255 & length >> 8, 255 & length]);
	}

	// Concatenate data and add it to the queue
	length = this.queue.length + header.length + data.length;
	this.queue = utils.buffer(this.queue, header, data, length);

	// Send fragmented frames from send queue splitted in 16384 bytes pieces
	function sendFragmented() {

		// If data is bigger than 16kB fragment and send it
		if (that.queue.length > 16384) {
			that.socket.write(that.queue.slice(0, 16384));
			that.queue = that.queue.slice(16384);
		} else {
			that.socket.write(that.queue);
			that.queue = new Buffer(0);
		}

		// If there are more elements then send them immediately
		if (that.queue.length) {
			that.sending = true;
			setImmediate(sendFragmented);
		} else {
			that.sending = false;
		}
	}

	// Start sending frames only if the connection is not sending something else
	if (!this.sending) {
		sendFragmented();
	}
};

module.exports = connection;