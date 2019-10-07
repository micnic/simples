'use strict';

const Random = require('simples/lib/utils/random');

const { stringify } = JSON;

const byte = 8; // Bits in one byte
const byteMaxValue = 0xFF; // Maximum value of a byte
const binaryFrameOpcode = 2; // Opcode for binary frame
const basePayloadLength = 125; // Bytes, the base length of frame payload
const closeCodeSize = 2; // Bytes reserved for code in close frame
const closeFrameOpcode = 0x08; // Opcode for close frame
const defaultHeadLength = 2; // Bytes, default length of frame head
const extended16BitLength = 126; // Value to mark 16bit payload length
const extendedHeadLength = 4; // Bytes, length of extended frame head
const extensionMask = 112; // Binary mask for frame extensions
const finFlagOffset = 7; // Offset of fin flag
const firstBitMask = 0x80; // Binary mask for the first bit
const maskLength = 4; // Bytes in a frame masking key
const maxFrameSize = 0xFFFF; // Bytes, maximum length of a frame
const normalWSCloseCode = 1000; // Code for normal WS close
const opcodeMask = 0x0F; // Binary mask for opcode
const payloadLengthMask = 0x7F; // Binary mask for payload length
const pingFrameOpcode = 0x09; // Opcode for ping frame
const pongFrameOpcode = 0x0A; // Opcode for pong frame
const protocolErrorCode = 1002; // Code for protocol errors
const reservedFutureCode = 1004; // Code reserved for future meaning
const reservedInternalAbnormalCloseCode = 1006; // Code for abnormal close
const reservedInternalMissingStatusCode = 1005; // Code for missing status
const reservedRangeEnd = 2999; // End code from reserved range 1012-2999
const reservedRangeStart = 1012; // Start code from reserved range 1012-2999
const textFrameOpcode = 0x01; // Opcode for text frame
const unusedRangeStart = 5000; // Undefined status code range start

class Frame {

	/**
	 * Frame constructor
	 * @param {Buffer} header
	 */
	constructor(header) {

		this.data = Buffer.alloc(0);
		this.extension = Boolean(header[0] & extensionMask);
		this.fin = Boolean(header[0] & firstBitMask);
		this.length = header[1] & payloadLengthMask;
		this.mask = null;
		this.masked = Boolean(header[1] & firstBitMask);
		this.opcode = header[0] & opcodeMask;
	}

	/**
	 * Prepare frame data
	 * @param {Buffer} data
	 */
	appendData(data) {

		const length = this.data.length + data.length;

		// Add the new data to the frame data
		this.data = Buffer.concat([this.data, data], length);

		// Check if full frame data is received to apply the mask if available
		if (this.masked && this.data.length === this.length) {
			Frame.xor(this.data, this.mask, 0);
		}
	}

	/**
	 * Prepare a frame buffer with the provided options and data
	 * @param {*} options
	 * @param {Buffer} data
	 * @returns {Buffer}
	 */
	static buffer(options, data) {

		let headLength = defaultHeadLength;

		// Check data length to increase header length
		if (data.length > basePayloadLength) {
			headLength = extendedHeadLength;
		}

		let frameLength = headLength + data.length;

		// Check for masked frame to increase the frame buffer length
		if (options.masked) {
			frameLength += maskLength;
		}

		const frame = Buffer.alloc(frameLength);

		// Set the fin flag and the opcode in the first byte
		frame[0] = (options.fin << finFlagOffset) | options.opcode;

		// Set the payload length
		if (data.length < extended16BitLength) {
			frame[1] = data.length;
		} else {
			frame[1] = extended16BitLength;
			frame[2] = (data.length >> byte) & byteMaxValue;
			frame[3] = data.length & byteMaxValue;
		}

		// Check for masked frame to generate masking key
		if (options.masked) {

			const mask = Random.randomBuffer(maskLength);

			// Set the masked flag
			frame[1] |= firstBitMask;

			// Copy the masking key to the frame buffer
			mask.copy(frame, headLength);

			// Add the data to the frame buffer
			data.copy(frame, headLength + maskLength);

			// Apply the masking key on the data bytes
			Frame.xor(frame, mask, headLength + maskLength);
		} else {
			data.copy(frame, headLength);
		}

		return frame;
	}

	/**
	 * Generate a WS close frame
	 * @param {number} code
	 * @param {boolean} masked
	 * @returns {Buffer}
	 */
	static close(code, masked) {

		const data = Buffer.alloc(closeCodeSize);
		const isMissingStatus = (code === reservedInternalMissingStatusCode);
		const isAbnormalClose = (code === reservedInternalAbnormalCloseCode);
		const internal = (isMissingStatus || isAbnormalClose);
		const fromReservedRangeStart = (code >= reservedRangeStart);
		const tillReservedRangeEnd = (code <= reservedRangeEnd);
		const reservedRange = (fromReservedRangeStart && tillReservedRangeEnd);
		const reserved = (code === reservedFutureCode || reservedRange);
		const unused = (code < normalWSCloseCode || code >= unusedRangeStart);

		// Check for status codes which should not be used for a close frame
		if (Number.isNaN(code) || unused || reserved || internal) {
			code = protocolErrorCode;
		}

		// Write the code bytes into the data buffer
		data[0] = (code >> byte) & byteMaxValue;
		data[1] = code & byteMaxValue;

		return Frame.buffer({
			fin: true,
			masked,
			opcode: closeFrameOpcode
		}, data);
	}

	/**
	 * Generate a WS ping frame
	 * @returns {Buffer}
	 */
	static ping() {

		return Frame.buffer({
			fin: true,
			masked: false,
			opcode: pingFrameOpcode
		}, Buffer.alloc(0));
	}

	/**
	 * Generate a WS pong frame
	 * @param {Frame} ping
	 * @param {boolean} masked
	 * @returns {Buffer}
	 */
	static pong(ping, masked) {

		return Frame.buffer({
			fin: true,
			masked,
			opcode: pongFrameOpcode
		}, ping.data);
	}

	/**
	 * Chunk and wrap data in WS frames
	 * @param {*} data
	 * @param {boolean} masked
	 * @param {Callback} callback
	 */
	static wrap(data, masked, callback) {

		let opcode = textFrameOpcode;

		// Check for binary data
		if (Buffer.isBuffer(data)) {
			opcode = binaryFrameOpcode;
		} else {

			// Stringify non-string data
			if (typeof data !== 'string') {
				data = stringify(data);
			}

			// Transform data to buffer
			data = Buffer.from(data);
		}

		// Check data size to wrap efficiently the data in frames
		if (data.length <= maxFrameSize) {
			callback(Frame.buffer({
				fin: true,
				masked,
				opcode
			}, data));
		} else {

			let offset = maxFrameSize;

			// Push the first frame of 64KB
			callback(Frame.buffer({
				fin: false,
				masked,
				opcode
			}, data.slice(0, maxFrameSize)));

			// Set the opcode to continuation frame
			opcode = 0;

			// Prepare in loop the intermediate frames
			while (offset < data.length - maxFrameSize) {

				// Push the next frame of 64KB
				callback(Frame.buffer({
					fin: false,
					masked,
					opcode
				}, data.slice(offset, offset + maxFrameSize)));

				// Increase the offset with the size of one frame
				offset += maxFrameSize;
			}

			// Push the last frame
			callback(Frame.buffer({
				fin: true,
				masked,
				opcode
			}, data.slice(offset)));
		}
	}

	/**
	 * Apply a mask on a buffer using xor operator
	 * @param {Buffer} buffer
	 * @param {Buffer} mask
	 * @param {number} index
	 */
	static xor(buffer, mask, index) {

		const [ byteA, byteB, byteC, byteD ] = mask;
		const { length } = buffer;

		let end = length - ((length - index) % maskLength);
		let i = index;

		// Loop through the buffer and apply xor
		while (i < end) {
			buffer[i++] ^= byteA;
			buffer[i++] ^= byteB;
			buffer[i++] ^= byteC;
			buffer[i++] ^= byteD;
		}

		// Get trailing bytes count
		end = length - i;

		// Check for at least one trailing byte
		if (end--) {
			buffer[i++] ^= byteA;

			// Check for at least two trailing bytes
			if (end--) {
				buffer[i++] ^= byteB;

				// Check for at least three trailing bytes
				if (end) {
					buffer[i] ^= byteC;
				}
			}
		}
	}
}

module.exports = Frame;