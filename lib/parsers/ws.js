'use strict';

var stream = require('stream'),
	utils = require('simples/utils/utils');

var usize = 65536;

var WsParser = function (limit, client) {

	// Call stream.Writable in this context
	stream.Writable.call(this);

	// Prepare the parser members
	this.buffer = Buffer(0);
	this.client = client;
	this.frame = null;
	this.index = 0;
	this.limit = limit;
	this.message = Buffer(0);
	this.state = 0;
};

// WS parser factory function
WsParser.create = function (limit, client) {

	return new WsParser(limit, client);
};

// Inherit from stream.Writable
WsParser.prototype = Object.create(stream.Writable.prototype, {
	constructor: {
		value: WsParser
	}
});

// Write method implementation
WsParser.prototype._write = function (chunk, encoding, callback) {

	var length = this.buffer.length + chunk.length;

	// Buffer received data
	if (this.buffer.length) {
		this.buffer = Buffer.concat([this.buffer, chunk], length);
	} else {
		this.index = 0;
		this.buffer = chunk;
	}

	// Act depending on the current state
	if (this.state === 0) {
		this.getHeader();
	} else if (this.state === 1) {
		this.getExtendedLength();
	} else if (this.state === 2) {
		this.getMask();
	} else if (this.state === 3) {
		this.getData();
	}

	// End the current write
	callback();
};

// Get frame data
WsParser.prototype.getData = function () {

	var chunk = null,
		frame = this.frame,
		length = 0,
		offset = this.index + frame.length - frame.data.length,
		that = this;

	// Prepare a new chunk of data
	if (offset > this.buffer.length) {
		chunk = this.buffer.slice(this.index);
	} else {
		chunk = this.buffer.slice(this.index, offset);
	}

	// Prepare the length of the received frame data
	length = frame.data.length + chunk.length;

	// Limit the received data
	if (this.limit && length > this.limit) {
		this.state = -1;
		this.emit('error', Error('Too long data received'));
	} else {

		// Update the frame data
		frame.data = Buffer.concat([frame.data, chunk], length);

		// Cut the chunk from the parser buffer
		this.buffer = this.buffer.slice(this.index + chunk.length);

		// Reset the parsing index
		this.index = 0;

		// Check if frame data is ready
		if (frame.length === frame.data.length) {
			if (this.client) {

				// Reset parser state and emit the frame
				this.state = 0;
				this.emit('frame', frame);

				// Check if there is more to parse
				if (this.buffer.length) {
					setImmediate(function () {
						that.getHeader();
					});
				}
			} else {
				this.state = 4;
				this.unmaskData();
			}
		}
	}
};

// Get 16bit or 32bit(not 64bit!) extended length
WsParser.prototype.getExtendedLength = function () {

	var rest = this.buffer.length - this.index;

	// Check if there is enough data to read the extended length
	if (this.frame.length === 126 && rest >= 2) {

		// Set the extended length
		this.frame.length = this.buffer.readUInt16BE(this.index);

		// Move the index for the next step
		this.index += 2;

		// Continue to the next state
		if (this.client) {
			this.state = 3;
			this.getData();
		} else {
			this.state = 2;
			this.getMask();
		}
	} else if (this.frame.length === 127 && rest >= 8) {

		// Read only 32bit length
		if (this.buffer.readUInt32BE(this.index)) {
			this.state = -1;
			this.emit('error', Error('Too long frame payload length'));
		} else {

			// Set the extended length
			this.frame.length = this.buffer.readUInt32BE(this.index + 4);

			// Move the index for the next step
			this.index += 8;

			// Continue to the next state
			if (this.client) {
				this.state = 3;
				this.getData();
			} else {
				this.state = 2;
				this.getMask();
			}
		}
	}
};

// Get the frame header
WsParser.prototype.getHeader = function () {

	var error = '',
		frame = null;

	// Check if there is enough data to read the header
	if (this.buffer.length - this.index >= 2) {

		// Prepare frame object
		frame = this.frame = {
			data: Buffer(0),
			fin: (this.buffer[this.index] & 128) === 128,
			length: this.buffer[this.index + 1] & 127,
			masked: (this.buffer[this.index + 1] & 128) === 128,
			opcode: this.buffer[this.index] & 15
		};

		// Check for errors
		if (this.buffer[this.index] & 112) {
			error = 'Extensions are not supported';
		} else if ((frame.opcode & 7) > 2) {
			error = 'Unknown frame type';
		} else if (frame.opcode > 7 && (frame.length > 125 || !frame.fin)) {
			error = 'Invalid control frame';
		} else if (frame.opcode === 9 && !this.client) {
			error = 'Ping frame received';
		} else if (frame.opcode === 10 && this.client) {
			error = 'Pong frame received';
		} else if (!frame.masked && !this.client) {
			error = 'Unmasked frame received';
		} else if (frame.masked && this.client) {
			error = 'Masked frame received';
		}

		// Move the index for the next step
		this.index += 2;

		// Continue to the next state
		if (error) {
			this.state = -1;
			this.emit('error', Error(error));
		} else if (frame.length > 125) {
			this.state = 1;
			this.getExtendedLength();
		} else if (this.client) {
			this.state = 3;
			this.getData();
		} else {
			this.state = 2;
			this.getMask();
		}
	}
};

// Get the masking key
WsParser.prototype.getMask = function () {

	// Check if there is enough data to read the masking key
	if (this.buffer.length - this.index >= 4) {

		// Get 4 bytes for the masking key
		this.frame.mask = this.buffer.slice(this.index, this.index + 4);

		// Move the index for the next step
		this.index += 4;

		// Continue to the next state
		this.state = 3;
		this.getData();
	}
};

// Apply the masking key on the frame data
WsParser.prototype.unmaskData = function () {

	var frame = this.frame,
		index = 0,
		that = this;

	// Unmask frame data using 64KB chunks
	function unmask() {
		if (frame.length - index > usize) {
			utils.xor(frame.data.slice(index, index + usize), frame.mask);
			index += usize;
			setImmediate(unmask);
		} else {

			// Unmask the last chunk of data
			utils.xor(frame.data.slice(index), frame.mask);
			that.state = 0;
			that.emit('frame', frame);

			// Check if there is more data to parse
			if (that.buffer.length) {
				setImmediate(function () {
					that.getHeader();
				});
			}
		}
	}

	// Start unmasking frame data
	unmask();
};

module.exports = WsParser;