'use strict';

var crypto = require('crypto'),
	events = require('events'),
	url = require('url'),
	utils = require('../../utils/utils');

var connection = function (host, wsHost, request) {

	var cookies,
		frame = {
			data: new Buffer(0),
			index: 0,
			message: new Buffer(0),
			state: 0
		},
		langs,
		protocol,
		session,
		socket = request.connection,
		that = this,
		timer;

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

	// Send a ping frame each 20 seconds of inactivity
	function keepAlive() {
		clearTimeout(timer);
		timer = setTimeout(function () {
			socket.write(new Buffer([137, 0]));
		}, 20000);
	}

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// WebSocket handshake
	socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n');
	socket.write('Connection: Upgrade\r\n');
	socket.write('Upgrade: WebSocket\r\n');
	socket.write('Sec-WebSocket-Accept: ' + crypto.Hash('sha1')
		.update(request.headers['sec-websocket-key'])
		.update('258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
		.digest('base64') + '\r\n');

	// Write origin only if requested
	if (request.headers.origin) {
		socket.write('Origin: ' + request.headers.origin + '\r\n');
	}

	// End the WebSocket handshake
	socket.write('\r\n');

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
	this.url = url.parse(protocol + request.headers.host + request.url, true);

	// The hostname from the host header
	this.host = this.url.hostname;

	// The object containing queries from the handshake HTTP request
	this.query = this.url.query;

	// The pathname of the url of the request
	this.path = this.url.pathname;

	// Define hidden properties
	Object.defineProperties(this, {
		config: {
			value: wsHost.config,
			writable: true
		},
		cookies: {
			enumerable: true,
			get: getCookies
		},
		keep: {
			value: keepAlive
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

	// Add the connection to the WebSocket host
	wsHost.connections.push(this);

	// Parse received data
	socket.on('readable', function () {
		utils.parseWS(that, frame, this.read());
	}).on('close', function () {
		wsHost.connections.splice(wsHost.connections.indexOf(that), 1);
		clearTimeout(timer);
		that.emit('close');
	});

	// Make it possible to bind to more than 10 channels
	this.setMaxListeners(0);

	// Execute user defined code for the WebSocket host
	try {
		wsHost.callback.call(wsHost, this);
	} catch (error) {
		console.error('\nsimpleS: Error in WebSocket > ' + error.stack + '\n');
		socket.destroy();
	}
};

// Inherit from events.EventEmitter
connection.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: connection,
		enumerable: false,
		writable: true,
		configurable: true
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

	// Prepare data depending on its length
	length = data.length;
	if (length < 126) {
		header = new Buffer([128 | type, length]);
	} else if (length < 65535) {
		header = new Buffer([128 | type, 126, 255 & length >> 8, 255 & length]);
	} else {

		// Get first frame
		header = new Buffer([type, 126, 255, 255]);
		this.queue = Buffer.concat([this.queue, header, data.slice(0, 65535)]);
		data = data.slice(65535);
		length = data.length;

		// Get next frames
		while (length > 65535) {
			header = new Buffer([0, 126, 255, 255]);
			this.queue = Buffer.concat([this.queue, header, data.slice(0, 65535)]);
			data = data.slice(65535);
			length = data.length;
		}

		// Get last frame depending on its length
		if (length < 126) {
			header = new Buffer([128, length]);
		} else {
			header = new Buffer([128, 126, 255 & length >> 8, 255 & length]);
		}
	}

	// Concatenate data and add it to the queue
	this.queue = Buffer.concat([this.queue, header, data]);

	// Send fragmented frames from send queue splitted in 1024 bytes pieces
	function sendFragmented() {

		// If data is bigger than 1kB fragment and send it
		if (that.queue.length > 1024) {
			that.socket.write(that.queue.slice(0, 1024));
			that.queue = that.queue.slice(1024);
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