'use strict';

const uv = require('uv');
const WSFrame = require('simples/lib/ws/frame');

const { Writable } = require('stream');

const {
	binaryFrameOpcode,
	closeCodeSize,
	closeFrameOpcode,
	continuationFrameOpcode,
	extended16BitLength,
	extended16BitLengthSize,
	extended64BitLength,
	extended64BitLengthSize,
	headerLength,
	knownOpcodeMask,
	maskLength,
	maxLengthSize,
	maxPlainPayloadLength,
	opcodeTailMask,
	pongFrameOpcode,
	textFrameOpcode
} = require('simples/lib/utils/constants');

const {
	expect16BitLength,
	expect64BitLength,
	expectData,
	expectHeader,
	expectMask,
	parsingFailed
} = require('simples/lib/utils/symbols');

class WSParser extends Writable {

	constructor(limit, client) {

		super();

		// Define WS parser properties
		this.buffer = null;
		this.bufferBytes = 0;
		this.client = client;
		this.frame = null;
		this.limit = limit;
		this.message = null;
		this.expect = expectHeader;
	}

	// Write method implementation
	_write(chunk, encoding, callback) {

		const length = chunk.length;

		let index = 0;

		// Loop through all received bytes
		while (index < length && this.expect !== parsingFailed) {

			// Get frame data or parse frame meta data
			if (this.expect === expectData) {
				index = this.getData(chunk, index, callback);
			} else {

				// Parse current byte
				this.parseByte(chunk[index], callback);

				index++;
			}
		}

		// If the parsing is not failed then end the current write
		if (this.expect !== parsingFailed) {
			callback(null);
		}
	}

	// Create the message based on the first frame in the sequence
	createMessage(callback) {

		// Create the message object
		this.message = {
			data: Buffer.alloc(0),
			type: 'text'
		};

		// Set the binary message type based on the frame opcode
		if (this.frame.opcode === binaryFrameOpcode) {
			this.message.type = 'binary';
		}

		// Prepare message data
		this.joinMessageData(callback);
	}

	// Emit close and ping control frames
	emitControlFrame(callback) {

		// For pong frames do nothing, for them the timeout is reset
		if (this.frame.opcode !== pongFrameOpcode) {

			// For close frame validate utf8 payload data
			if (this.frame.opcode === closeFrameOpcode) {

				const data = this.frame.data.slice(closeCodeSize);

				// For invalid data stop parsing and emit error
				if (!uv(data)) {
					this.expect = parsingFailed;
					callback(Error('Invalid UTF8 data received on close'));
				}
			}

			// Check if the parsing did not fail to emit the control frame
			if (this.expect !== parsingFailed) {
				this.emit('control', this.frame);
			}
		}
	}

	// Emit the message when it is ready
	emitMessage(callback) {

		// Validate and stringify message text data
		if (this.message.type === 'text') {
			if (uv(this.message.data)) {
				this.message.data = String(this.message.data);
			} else {
				this.expect = parsingFailed;
				callback(Error('Invalid UTF8 message data'));
			}
		}

		// Emit the message if the parsing did not fail
		if (this.expect !== parsingFailed) {
			this.emit('message', this.message);
		}

		// Remove the reference to the message object
		this.message = null;
	}

	// Finalize the processing of the current frame and reset its reference
	endFrameProcessing(callback) {

		// Check for frame opcode to prepare the message
		if (this.frame.opcode === continuationFrameOpcode) {
			this.joinMessageData(callback);
		} else if (this.frame.opcode <= binaryFrameOpcode) {
			this.createMessage(callback);
		} else {
			this.emitControlFrame(callback);
		}

		// Only if parsing did not fail continue parsing
		if (this.expect !== parsingFailed) {
			this.frame = null;
			this.expect = expectHeader;
		}
	}

	getData(chunk, index, callback) {

		const frame = this.frame;
		const offset = index + frame.length - frame.data.length;

		// Update the frame data
		frame.appendData(chunk.slice(index, offset));

		// Check if frame data is ready to end frame processing
		if (frame.length === frame.data.length) {
			this.endFrameProcessing(callback);
		}

		return offset;
	}

	// Prepare message data from received frame data
	joinMessageData(callback) {

		const frame = this.frame;
		const message = this.message;
		const length = message.data.length + frame.data.length;

		// Add the frame data to the message data
		message.data = Buffer.concat([message.data, frame.data], length);

		// Check for last frame to emit message
		if (frame.fin) {
			this.emitMessage(callback);
		}
	}

	// Parse 16bit extended frame length
	parse16BitLength(byte) {

		// Check if the extended length buffer is ready to be parsed
		if (this.readyBuffer(extended16BitLengthSize, byte)) {

			// Set the extended length
			this.frame.length = this.buffer.readUInt16BE();

			// Reset buffer data
			this.resetBuffer();

			// Continue to the next state
			if (this.client) {
				this.expect = expectData;
			} else {
				this.expect = expectMask;
			}
		}
	}

	// Parse 64bit extended frame length
	parse64BitLength(byte, callback) {

		// Check if the extended length buffer is ready to be parsed
		if (this.readyBuffer(extended64BitLengthSize, byte)) {

			// Check for 64bit length, but read only 32bit length
			if (this.buffer.readUInt32BE()) {
				this.expect = parsingFailed;
				callback(Error('Too long frame payload length'));
			} else {

				// Set the extended length
				this.frame.length = this.buffer.readUInt32BE(maxLengthSize);

				// Move the index for the next step
				this.resetBuffer();

				// Continue to the next state
				if (this.client) {
					this.expect = expectData;
				} else {
					this.expect = expectMask;
				}
			}
		}
	}

	// Parse current byte
	parseByte(byte, callback) {
		if (this.expect === expect16BitLength) {
			this.parse16BitLength(byte);
		} else if (this.expect === expect64BitLength) {
			this.parse64BitLength(byte, callback);
		} else if (this.expect === expectMask) {
			this.parseMask(byte, callback);
		} else {
			this.parseHeader(byte, callback);
		}
	}

	// Parse and validate frame header
	parseHeader(byte, callback) {

		// Check if the frame header buffer is ready to be parsed
		if (this.readyBuffer(headerLength, byte)) {

			// Prepare frame object
			this.frame = WSFrame.create(this.buffer);

			// Reset buffer data
			this.resetBuffer();

			// Validate frame data
			this.validateFrame(callback);

			// Check for valid frame data to continue parsing
			if (this.expect !== parsingFailed) {
				if (this.frame.length === extended16BitLength) {
					this.expect = expect16BitLength;
				} else if (this.frame.length === extended64BitLength) {
					this.expect = expect64BitLength;
				} else if (this.client) {
					if (this.frame.length) {
						this.expect = expectData;
					} else {
						this.endFrameProcessing(callback);
					}
				} else {
					this.expect = expectMask;
				}
			}
		}
	}

	// Parse frame masking key
	parseMask(byte, callback) {

		// Check if the frame masking key buffer is ready to be parsed
		if (this.readyBuffer(maskLength, byte)) {

			// Set frame masking key
			this.frame.mask = this.buffer;

			// Reset buffer data
			this.resetBuffer();

			// Continue to data parsing or end frame processing
			if (this.frame.length) {
				this.expect = expectData;
			} else {
				this.endFrameProcessing(callback);
			}
		}
	}

	// Prepare a buffer with the provided length and bytes to allow parsing
	readyBuffer(length, byte) {

		// Check for buffer, if there is none allocate a new one
		if (!this.buffer) {
			this.buffer = Buffer.alloc(length);
		}

		// Write the current byte to the buffer
		this.buffer[this.bufferBytes] = byte;
		this.bufferBytes++;

		return (this.bufferBytes === length);
	}

	// Reset buffer data
	resetBuffer() {
		this.buffer = null;
		this.bufferBytes = 0;
	}

	// Validate the frame meta data
	validateFrame(callback) {

		const client = this.client;
		const frame = this.frame;
		const isBinaryFrame = (frame.opcode === binaryFrameOpcode);
		const isControlFrame = (frame.opcode > opcodeTailMask);
		const isExtendedLengthFrame = (frame.length > maxPlainPayloadLength);
		const isTextFrame = (frame.opcode === textFrameOpcode);
		const isNonControlFrame = (isBinaryFrame || isTextFrame);
		const limit = this.limit;
		const message = this.message;

		let error = '';
		let length = frame.length;

		// Check for message to validate data length
		if (message) {
			length += message.data.length;
		}

		// Check for errors
		if (frame.extension) {
			error = 'Extensions are not supported';
		} else if (frame.opcode === continuationFrameOpcode && !message) {
			error = 'Invalid continuation frame';
		} else if (isNonControlFrame && message) {
			error = 'Continuation frame expected';
		} else if ((frame.opcode & opcodeTailMask) > knownOpcodeMask) {
			error = 'Unknown frame type';
		} else if (isControlFrame && (isExtendedLengthFrame || !frame.fin)) {
			error = 'Invalid control frame';
		} else if (frame.masked && client) {
			error = 'Masked frame received from the server';
		} else if (!frame.masked && !client) {
			error = 'Unmasked frame received from the client';
		} else if (limit && length > limit) {
			error = 'Too long data received';
		}

		// Check for any error to emit it
		if (error) {
			this.expect = parsingFailed;
			callback(Error(error));
		}
	}

	// WS parser factory method
	static create(limit, client) {

		return new WSParser(limit, client);
	}
}

module.exports = WSParser;