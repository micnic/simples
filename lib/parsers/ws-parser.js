'use strict';

const uv = require('uv');
const Frame = require('simples/lib/ws/frame');
const { Writable } = require('stream');

const basePayloadLength = 125; // Bytes, the base length of frame payload
const binaryFrameOpcode = 2; // Opcode for binary frame
const closeCodeSize = 2; // Bytes reserved for code in close frame
const closeFrameOpcode = 8; // Opcode for close frame
const continuationFrameOpcode = 0; // Opcode for continuation frame
const extended16BitLength = 126; // Value to mark 16bit payload length
const extended16BitLengthSize = 2; // Bytes for 16bit extended payload length
const extended64BitLength = 127; // Value to mark 64bit payload length
const extended64BitLengthSize = 8; // Bytes for 64bit extended payload length
const headerLength = 2; // Bytes in a frame header
const knownOpcodeMask = 0x02; // Binary mask for known opcodes
const maskLength = 4; // Bytes in a frame masking key
const maxLengthSize = 4; // Bytes for max usable payload length
const opcodeTailMask = 7; // Binary mask for opcode tail
const pongFrameOpcode = 10; // Opcode for pong frame
const textFrameOpcode = 1; // Opcode for text frame

// WS parser states
const expect16BitLength = Symbol('expect-16bit-length');
const expect64BitLength = Symbol('expect-64bit-length');
const expectData = Symbol('expect-data');
const expectHeader = Symbol('expect-header');
const expectMask = Symbol('expect-mask');
const parsingFailed = Symbol('parsing-failed');

class WSParser extends Writable {

	/**
	 * WSParser constructor
	 * @param {number} limit
	 * @param {boolean} client
	 */
	constructor(limit, client) {

		super();

		// Define WS parser properties
		this.buffer = null;
		this.bufferBytes = 0;
		this.client = client;
		this.expect = expectHeader;
		this.frame = null;
		this.limit = limit;
		this.message = null;
	}

	/**
	 * Write method implementation
	 * @param {string|Buffer} chunk
	 * @param {string} encoding
	 * @param {Callback} callback
	 */
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

	/**
	 * Create the message based on the first frame in the sequence
	 * @param {Callback} callback
	 */
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

	/**
	 * Emit close and ping control frames
	 * @param {Callback} callback
	 */
	emitControlFrame(callback) {

		const { frame } = this;

		// For close frame validate utf8 payload data
		if (frame.opcode === closeFrameOpcode) {

			const data = frame.data.slice(closeCodeSize);

			// For invalid data stop parsing and emit error
			if (!uv(data)) {
				this.expect = parsingFailed;
				callback(Error('Invalid UTF8 data received on close'));
			}
		}

		// Emit control frame if no error is emitted, for pong frame do nothing
		if (frame.opcode !== pongFrameOpcode && this.expect !== parsingFailed) {
			this.emit('control', frame);
		}
	}

	/**
	 * Emit the message when it is ready
	 * @param {Callback} callback
	 */
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

	/**
	 * Finalize the processing of the current frame and reset its reference
	 * @param {Callback} callback
	 */
	endFrameProcessing(callback) {

		// Check for frame opcode to prepare the message
		if (this.frame.opcode === continuationFrameOpcode) {
			this.joinMessageData(callback);
		} else if (this.frame.opcode <= binaryFrameOpcode) {
			this.createMessage(callback);
		} else {
			this.emitControlFrame(callback);
		}

		// Reset frame object
		this.frame = null;

		// Only if parsing did not fail continue parsing
		if (this.expect !== parsingFailed) {
			this.expect = expectHeader;
		}
	}


	/**
	 * Get frame data
	 * @param {Buffer} chunk
	 * @param {number} index
	 * @param {Callback} callback
	 */
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

	/**
	 * Prepare message data from received frame data
	 * @param {Callback} callback
	 */
	joinMessageData(callback) {

		const { frame, message } = this;
		const length = message.data.length + frame.data.length;

		// Add the frame data to the message data
		message.data = Buffer.concat([message.data, frame.data], length);

		// Check for last frame to emit message
		if (frame.fin) {
			this.emitMessage(callback);
		}
	}

	/**
	 * Parse 16bit extended frame length
	 * @param {number} byte
	 */
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

	/**
	 * Parse 64bit extended frame length
	 * @param {number} byte
	 */
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

	/**
	 * Parse current byte
	 * @param {number} byte
	 * @param {Callback} callback
	 */
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

	/**
	 * Parse and validate frame header
	 * @param {number} byte
	 * @param {Callback} callback
	 */
	parseHeader(byte, callback) {

		// Check if the frame header buffer is ready to be parsed
		if (this.readyBuffer(headerLength, byte)) {

			// Prepare frame object
			this.frame = new Frame(this.buffer);

			// Reset buffer data
			this.resetBuffer();

			// Check for valid frame data to continue parsing
			if (this.validateFrame(callback)) {

				const { client, frame, limit, message } = this;

				let { length } = frame;

				// Check for message to increase total length
				if (message) {
					length += message.data.length;
				}

				// Check for limit constrain and continue to next steps
				if (limit && length > limit) {
					this.expect = parsingFailed;
					callback(Error('Too long data received'));
				} else if (frame.length === extended16BitLength) {
					this.expect = expect16BitLength;
				} else if (frame.length === extended64BitLength) {
					this.expect = expect64BitLength;
				} else if (client) {
					if (frame.length) {
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

	/**
	 * Parse frame masking key
	 * @param {number} byte
	 * @param {Callback} callback
	 */
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

	/**
	 * Prepare a buffer with the provided length and bytes to allow parsing
	 * @param {number} length
	 * @param {number} byte
	 * @returns {boolean}
	 */
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

	/**
	 * Reset buffer data
	 */
	resetBuffer() {
		this.buffer = null;
		this.bufferBytes = 0;
	}

	/**
	 * Validate the frame meta data
	 * @param {Callback} callback
	 */
	validateFrame(callback) {

		const client = this.client;
		const frame = this.frame;
		const isBinaryFrame = (frame.opcode === binaryFrameOpcode);
		const isControlFrame = (frame.opcode > opcodeTailMask);
		const isExtendedLengthFrame = (frame.length > basePayloadLength);
		const isTextFrame = (frame.opcode === textFrameOpcode);
		const isNonControlFrame = (isBinaryFrame || isTextFrame);
		const message = this.message;

		let error = '';

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
		}

		// Check for any error to emit it
		if (error) {
			this.expect = parsingFailed;
			callback(Error(error));

			return false;
		}

		return true;
	}
}

WSParser.states = {
	expect16BitLength,
	expect64BitLength,
	expectData,
	expectHeader,
	expectMask,
	parsingFailed
};

module.exports = WSParser;