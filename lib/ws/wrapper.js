'use strict';

var utils = require('simples/utils/utils');

// WS wrapper prototype constructor
var WsWrapper = exports;

// Prepare frame header
WsWrapper.header = function (fin, opcode, length) {

	var header = Buffer(2);

	// Use 4 bytes header for length greater than 125 bytes
	if (length > 125) {
		header = Buffer(4);
	}

	// Set the fin flag and the opcode in the first byte
	header[0] = 128 & fin << 7 | opcode;

	// Set the payload length
	if (length < 126) {
		header[1] = length;
	} else {
		header[1] = 126;
		header[2] = 255 & length >> 8;
		header[3] = 255 & length;
	}

	return header;
};

// Prepare formatted data based on the WS mode
WsWrapper.format = function (mode, event, data) {

	// Prepare data structure
	if (mode === 'object') {
		data = {
			event: event,
			data: data
		};
	} else {
		data = event;
	}

	// Check for non buffer data
	if (!Buffer.isBuffer(data)) {

		// Stringify data which is not string
		if (typeof data !== 'string') {
			data = JSON.stringify(data);
		}

		// Transform the data in a buffer
		data = Buffer(data || 0);
	}

	return data;
};

// Wrap data in WS frames
WsWrapper.frame = function (header, data, masked) {

	var frame = Buffer(header.length + data.length + masked * 4),
		mask = null;

	// Add the header to the frame buffer
	header.copy(frame);

	// Check for masked frame
	if (masked) {

		// Set the masked flag
		frame[1] |= 128;

		// Create the masking key and copy it to the frame buffer
		mask = utils.randomBytes(4);
		mask.copy(frame, header.length);

		// Add the data to the frame buffer
		data.copy(frame, header.length + 4);

		// Apply the masking key on the data bytes
		utils.xor(frame.slice(header.length + 4), mask);
	} else {
		data.copy(frame, header.length);
	}

	return frame;
};

// Chunk and wrap data in WS frames
WsWrapper.wrap = function (options, data, callback) {

	var connection = options.connection,
		masked = options.masked,
		mode = options.mode,
		opcode = 1;

	// Wrap chunks of data asychronously
	function wrap(chunk) {

		var header = null,
			wrapped = null;

		// Check the length of the data and split it in smaller chunks
		if (chunk.length > 65535) {
			header = WsWrapper.header(false, opcode, 65535);
			wrapped = WsWrapper.frame(header, chunk.slice(0, 65535), masked);
			connection.push(wrapped);
			opcode = 0;
			setImmediate(wrap, chunk.slice(65535));
		} else {
			header = WsWrapper.header(true, opcode, chunk.length);
			wrapped = WsWrapper.frame(header, chunk, masked);
			connection.push(wrapped);
			callback();
		}
	}

	// Check for binary data
	if (mode === 'binary') {
		opcode = 2;
	}

	// Prepare data for sending
	wrap(data);
};