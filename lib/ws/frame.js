'use strict';

const Random = require('simples/lib/utils/random');

const {
	binaryFrameOpcode,
	byte,
	byteMaxValue,
	closeCodeSize,
	closeFrameOpcode,
	defaultHeadLength,
	extended16BitLength,
	extendedHeadLength,
	extensionMask,
	finFlagOffset,
	firstBitMask,
	initialFrameDataLength,
	maskFlagBit,
	maskLength,
	maxFrameSize,
	opcodeMask,
	normalWsCloseCode,
	payloadLengthMask,
	pingFrameOpcode,
	pongFrameOpcode,
	protocolErrorCode,
	reservedFutureCode,
	reservedInternalAbnormalCloseCode,
	reservedInternalMissingStatusCode,
	reservedRangeEnd,
	reservedRangeStart,
	textFrameOpcode,
	unusedRangeStart
} = require('simples/lib/utils/constants');

class WsFrame {

	constructor(header) {

		this.data = Buffer.alloc(0);
		this.extension = Boolean(header[0] & extensionMask);
		this.fin = Boolean(header[0] & firstBitMask);
		this.length = header[1] & payloadLengthMask;
		this.mask = null;
		this.masked = Boolean(header[1] & firstBitMask);
		this.opcode = header[0] & opcodeMask;
	}

	// Prepare frame data
	appendData(data) {

		const length = this.data.length + data.length;

		// Add the new data to the frame data
		this.data = Buffer.concat([this.data, data], length);

		// Check if full frame data is received to apply the mask if available
		if (this.masked && this.data.length === this.length) {
			WsFrame.xor(this.data, this.mask, 0);
		}
	}

	// Prepare a frame buffer with the provided options and data
	static buffer(options, data) {

		let headLength = defaultHeadLength;

		// Check data length to increase header length
		if (data.length > initialFrameDataLength) {
			headLength = extendedHeadLength;
		}

		let frameLength = headLength + data.length;

		// Check for masked frame to increase the frame buffer length
		if (options.masked) {
			frameLength += maskLength;
		}

		const frame = Buffer.alloc(frameLength);

		// Set the fin flag and the opcode in the first byte
		frame[0] = options.fin << finFlagOffset | options.opcode;

		// Set the payload length
		if (data.length < extended16BitLength) {
			frame[1] = data.length;
		} else {
			frame[1] = extended16BitLength;
			frame[2] = data.length >> byte & byteMaxValue;
			frame[3] = data.length & byteMaxValue;
		}

		// Check for masked frame to generate masking key
		if (options.masked) {

			const mask = Random.randomBuffer(maskLength);

			// Set the masked flag
			frame[1] |= maskFlagBit;

			// Copy the masking key to the frame buffer
			mask.copy(frame, headLength);

			// Add the data to the frame buffer
			data.copy(frame, headLength + maskLength);

			// Apply the masking key on the data bytes
			WsFrame.xor(frame, mask, headLength + maskLength);
		} else {
			data.copy(frame, headLength);
		}

		return frame;
	}

	// Generate a WS close frame
	static close(code, masked) {

		const data = Buffer.alloc(closeCodeSize);

		const isMissingStatus = (code === reservedInternalMissingStatusCode);
		const isAbnormalClose = (code === reservedInternalAbnormalCloseCode);
		const internal = (isMissingStatus || isAbnormalClose);
		const fromReservedRangeStart = (code >= reservedRangeStart);
		const tillReservedRangeEnd = (code <= reservedRangeEnd);
		const reservedRange = (fromReservedRangeStart && tillReservedRangeEnd);
		const reserved = (code === reservedFutureCode || reservedRange);
		const unused = (code < normalWsCloseCode || code >= unusedRangeStart);

		// Check for status codes which should not be used for a close frame
		if (Number.isNaN(code) || unused || reserved || internal) {
			code = protocolErrorCode;
		}

		// Write the code bytes into the data buffer
		data[0] = code >> byte & byteMaxValue;
		data[1] = code & byteMaxValue;

		return WsFrame.buffer({
			fin: true,
			masked,
			opcode: closeFrameOpcode
		}, data);
	}

	// Frame factory method
	static create(header) {

		return new WsFrame(header);
	}

	// Generate a WS ping frame
	static ping() {

		return WsFrame.buffer({
			fin: true,
			masked: false,
			opcode: pingFrameOpcode
		}, Buffer.alloc(0));
	}

	// Generate a WS pong frame
	static pong(ping, masked) {

		return WsFrame.buffer({
			fin: true,
			masked,
			opcode: pongFrameOpcode
		}, ping.data);
	}

	// Chunk and wrap data in WS frames
	static wrap(data, masked, callback) {

		let opcode = textFrameOpcode;

		// Check for binary data
		if (Buffer.isBuffer(data)) {
			opcode = binaryFrameOpcode;
		} else {

			// Stringify non-string data
			if (typeof data !== 'string') {
				data = JSON.stringify(data);
			}

			// Transform data to buffer
			data = Buffer.from(data);
		}

		// Check data size to wrap efficiently the data in frames
		if (data.length <= maxFrameSize) {
			callback(WsFrame.buffer({
				fin: true,
				masked,
				opcode
			}, data));
		} else {

			let offset = maxFrameSize;

			// Push the first frame of 64KB
			callback(WsFrame.buffer({
				fin: false,
				masked,
				opcode
			}, data.slice(0, maxFrameSize)));

			// Set the opcode to continuation frame
			opcode = 0;

			// Prepare in loop the intermediate frames
			while (offset < data.length - maxFrameSize) {

				// Push the next frame of 64KB
				callback(WsFrame.buffer({
					fin: false,
					masked,
					opcode
				}, data.slice(offset, offset + maxFrameSize)));

				// Increase the offset with the size of one frame
				offset += maxFrameSize;
			}

			// Push the last frame
			callback(WsFrame.buffer({
				fin: true,
				masked,
				opcode
			}, data.slice(offset)));
		}
	}

	// Apply a mask on a buffer using xor operator
	static xor(buffer, mask, index) {

		const end = buffer.length;

		let masked = 0;

		// Loop through the buffer and apply xor
		while (index < end) {
			buffer[index] ^= mask[masked % maskLength];
			masked++;
			index++;
		}
	}
}

module.exports = WsFrame;