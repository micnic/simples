'use strict';

const arrayNotationLength = 2; // Length of array notation "[]"
const binaryFrameOpcode = 2; // Opcode for binary frame
const byte = 8; // Bits in one byte
const byteMaxValue = 255; // Maximum value of a byte
const carriageReturn = 13; // Char code for "\r" (carriage return)
const closeCodeSize = 2; // Bytes reserved for code in close frame
const closeFrameOpcode = 8; // Opcode for close frame
const continuationFrameOpcode = 0; // Opcode for continuation frame
const dateFormatSlice = 2; // Slice from the date format to get last to digits
const defaultHeadLength = 2; // Bytes, default length of frame head
const extended16BitLength = 126; // Value to mark 16bit payload length
const extended16BitLengthSize = 2; // Bytes for 16bit extended payload length
const extended64BitLength = 127; // Value to mark 64bit payload length
const extended64BitLengthSize = 8; // Bytes for 64bit extended payload length
const extendedHeadLength = 4; // Bytes, length of extended frame head
const extensionMask = 112; // Binary mask for frame extensions
const finFlagOffset = 7; // Offset of fin flag
const firstBitMask = 128; // Binary mask for getting the first bit
const handshakeKeyLength = 16; // Length of WS handshake key
const headerLength = 2; // Bytes in a frame header
const hyphenMinus = 45; // Char code for "-" (hyphen minus)
const initialBoundaryIndex = 2; // Starting index for boundary parsing
const internalServerErrorStatusCode = 500; // Status code for error 500 response
const knownOpcodeMask = 0x02; // Binary mask for known opcodes
const lineFeed = 10; // Char code for "\n" (line feed)
const maskLength = 4; // Bytes in a frame masking key
const maskFlagBit = 128; // Bit that mark the mask
const maxFrameSize = 65535; // Bytes, maximum length of a frame
const maxLengthSize = 4; // Bytes for max usable payload length
const initialFrameDataLength = 125; // Bytes, the initial length of frame data
const megabyte = 1048576; // Bytes, 1 MB
const methodNotAllowedStatusCode = 405; // Status code for error 405 response
const minTimeout = 2000; // Two seconds, minimal timeout for a WS connection
const minute = 60000; // Milliseconds in one minute
const noContentStatusCode = 204; // Status code for message 204 response
const normalWSCloseCode = 1000; // Code for normal WS close
const notFoundStatusCode = 404; // Status code for error 404 response
const notModifiedStatusCode = 304; // Status code for message 304 response
const opcodeMask = 15; // Binary mask for opcode
const opcodeTailMask = 7; // Binary mask for opcode tail
const payloadLengthMask = 0x7F; // Binary mask for payload length
const pingFrameOpcode = 9; // Opcode for ping frame
const pongFrameOpcode = 10; // Opcode for pong frame
const protocolErrorCode = 1002; // Code for protocol errors
const reservedFutureCode = 1004; // Code reserved for future meaning
const reservedInternalAbnormalCloseCode = 1006; // Code for abnormal close
const reservedInternalMissingStatusCode = 1005; // Code for missing status
const reservedRangeEnd = 2999; // End code from reserved range 1012-2999
const reservedRangeStart = 1012; // Start code from reserved range 1012-2999
const second = 1000; // Milliseconds in one second
const textFrameOpcode = 1; // Opcode for text frame
const unusedRangeStart = 5000; // Undefined status code range start
const wsTimeout = 30000; // Milliseconds, default WS timeout

const emptyString = ''; // Empty string for general use
const wsGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'; // RFC6455 WS GUID



const verbs = new Map(); // Supported REST verbs

// Add the supported REST verbs
verbs.set('DELETE', 'del');
verbs.set('GET', 'get');
verbs.set('HEAD', 'get');
verbs.set('PATCH', 'patch');
verbs.set('POST', 'post');
verbs.set('PUT', 'put');

const verbMethods = Array.from(verbs.keys()); // Supported verb methods
const allowedHTTPMethods = verbMethods.join(','); // String join of http methods

const cacheEvents = {
	error: 'error',
	ready: 'ready'
};

// Chars container used for parsing
const chars = {
	comma: ',',
	equalsSign: '=',
	semicolon: ';'
};

const errors = {
	invalidUtf8Data: Error('Invalid UTF8 data received')
};

// Stream options to read in object mode
const readableObjectMode = {
	readableObjectMode: true
};

// Stream options to read in object mode and to not decode strings
const stringReadableObjectMode = {
	decodeStrings: false,
	readableObjectMode: true
};

// Stream options to not decode strings
const stringStreamOptions = {
	decodeStrings: false
};

module.exports = {
	allowedHTTPMethods,
	arrayNotationLength,
	binaryFrameOpcode,
	byte,
	byteMaxValue,
	cacheEvents,
	carriageReturn,
	chars,
	closeCodeSize,
	closeFrameOpcode,
	continuationFrameOpcode,
	dateFormatSlice,
	defaultHeadLength,
	emptyString,
	errors,
	extended16BitLength,
	extended16BitLengthSize,
	extended64BitLength,
	extended64BitLengthSize,
	extendedHeadLength,
	extensionMask,
	finFlagOffset,
	firstBitMask,
	handshakeKeyLength,
	headerLength,
	hyphenMinus,
	initialBoundaryIndex,
	initialFrameDataLength,
	internalServerErrorStatusCode,
	knownOpcodeMask,
	lineFeed,
	maskFlagBit,
	maskLength,
	maxFrameSize,
	maxLengthSize,
	megabyte,
	methodNotAllowedStatusCode,
	minTimeout,
	minute,
	noContentStatusCode,
	normalWSCloseCode,
	notFoundStatusCode,
	notModifiedStatusCode,
	opcodeMask,
	opcodeTailMask,
	payloadLengthMask,
	pingFrameOpcode,
	pongFrameOpcode,
	protocolErrorCode,
	readableObjectMode,
	reservedFutureCode,
	reservedInternalAbnormalCloseCode,
	reservedInternalMissingStatusCode,
	reservedRangeEnd,
	reservedRangeStart,
	second,
	stringReadableObjectMode,
	stringStreamOptions,
	textFrameOpcode,
	unusedRangeStart,
	verbMethods,
	verbs,
	wsGuid,
	wsTimeout
};