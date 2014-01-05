'use strict';

var events = require('events'),
	url = require('url'),
	utils = require('simples/utils/utils');

// WS connection prototype constructor
var connection = function (host, config, request) {

	var hostname = request.headers.host || 'main',
		langs = [],
		protocol = 'ws://',
		socket = request.connection,
		subprotocols = request.headers['sec-websocket-protocol'];

	// Getter for accepted language
	function getLangs() {

		// Check if languages are not already parsed
		if (!langs) {
			langs = utils.parseLangs(request);
		}

		return langs;
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Define special properties for the WS connection
	Object.defineProperties(this, {
		channels: {
			value: []
		},
		config: {
			value: config
		},
		langs: {
			enumerable: true,
			get: getLangs
		},
		socket: {
			value: socket
		}
	});

	// Set secured WS protocol
	if (socket.encrypted) {
		protocol = 'wss://';
	}

	// Create and populate connection members
	this.cookies = utils.parseCookies(request);
	this.headers = request.headers;
	this.ip = socket.remoteAddress;
	this.protocols = (subprotocols || '').split(/,\s*/);
	this.url = url.parse(protocol + hostname + request.url, true);
	this.host = this.url.hostname;
	this.query = this.url.query;
	this.path = this.url.pathname;
	this.protocol = protocol.slice(0, -3);
	this.session = host.sessions[this.cookies._session];

	// Render from the template engine SHOULD BE ONLY FOR RAW MODE
	this.render = function (event, source, imports) {

		// Prepare data
		if (this.config.raw) {
			source = event;
			imports = source;
		}

		// Inject connection to imports
		imports = imports || {};
		imports.connection = this;

		// Check from raw or advanced mode
		if (this.config.raw) {
			this.send(host.render(source, imports));
		} else {
			this.send(event, host.render(source, imports));
		}
	};

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

	var header = new Buffer(0),
		length = 0,
		queue = new Buffer(0),
		type = 2;

	// Prepare data
	if (this.config.raw) {
		data = event;
	} else {
		data = {
			binary: Buffer.isBuffer(data),
			event: event,
			data: data
		};
	}

	// Data type, may be binary or text
	if (!Buffer.isBuffer(data)) {

		// Stringify data which is not string
		if (typeof data !== 'string') {
			data = JSON.stringify(data);
		}

		data = new Buffer(data || 0);
		type = 1;
	}

	// Cache data length
	length = data.length;

	// Prepare data which is bigger that 16KB
	if (length > 65535) {

		// Prepare the first 64KB frame
		header = new Buffer([type, 126, 255, 255]);
		queue = utils.buffer(queue, header, data.slice(0, 65535), 65539);
		data = data.slice(65535);
		length = data.length;
		type = 0;

		// Prepare the next 64KB frames
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