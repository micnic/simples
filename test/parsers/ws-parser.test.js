'use strict';

const tap = require('tap');

const symbols = require('simples/lib/utils/symbols');
const Frame = require('simples/lib/ws/frame');
const WSParser = require('simples/lib/parsers/ws-parser');

const { Writable } = require('stream');

tap.test('WSParser.prototype.constructor', (test) => {

	const parser = new WSParser(0, true);

	test.ok(parser instanceof WSParser);
	test.ok(parser instanceof Writable);
	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		client: true,
		expect: symbols.expectHeader,
		frame: null,
		limit: 0,
		message: null
	});

	test.end();
});

tap.test('WSParser.prototype.readyBuffer', (test) => {

	const parser = new WSParser(0, true);

	let result = parser.readyBuffer(2, 0x00);

	test.ok(result === false);
	test.match(parser, {
		buffer: Buffer.alloc(2),
		bufferBytes: 1
	});

	// --------------------

	result = parser.readyBuffer(2, 0x00);

	test.ok(result);
	test.match(parser, {
		buffer: Buffer.alloc(2),
		bufferBytes: 2
	});

	test.end();
});

tap.test('WSParser.prototype.resetBuffer', (test) => {

	const parser = new WSParser(0, true);

	parser.buffer = Buffer.alloc(1);
	parser.bufferBytes = 1;

	parser.resetBuffer();

	test.match(parser, {
		buffer: null,
		bufferBytes: 0
	});

	test.end();
});

tap.test('WSParser.prototype.validateFrame', (test) => {

	const parser = new WSParser(0, true);

	parser.frame = {};

	parser.validateFrame(() => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	parser.frame.extension = true;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.frame.extension = false;
	parser.frame.opcode = 0;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.frame.opcode = 1;
	parser.message = {
		data: Buffer.alloc(0)
	};

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.frame.opcode = 3;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.frame.opcode = 8;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.frame.opcode = 0;
	parser.frame.masked = true;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.frame.masked = false;
	parser.client = false;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	// --------------------

	parser.limit = 1;
	parser.frame.masked = true;
	parser.frame.length = 2;

	parser.validateFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	test.end();
});

tap.test('WSParser.prototype.emitMessage', (test) => {

	const parser = new WSParser(0, true);
	const fakeMessage = {};

	parser.on('message', (message) => {
		test.ok(message === fakeMessage);

		if (message.type === 'text') {
			test.ok(message.data === '');
		}
	});

	parser.message = fakeMessage;

	parser.emitMessage(() => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.message === null);

	// --------------------

	fakeMessage.type = 'text';
	fakeMessage.data = Buffer.alloc(0);
	parser.message = fakeMessage;

	parser.emitMessage(() => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.message === null);

	// --------------------

	fakeMessage.type = 'text';
	fakeMessage.data = Buffer.from([0x80]);
	parser.message = fakeMessage;

	parser.emitMessage((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	test.ok(parser.message === null);

	test.end();
});

tap.test('WSParser.prototype.joinMessageData', (test) => {

	const parser = new WSParser(0, true);
	const fakeMessage = {};

	parser.on('message', (message) => {
		test.ok(message === fakeMessage);
	});

	parser.frame = {
		data: Buffer.alloc(0),
		mask: Buffer.alloc(4)
	};

	fakeMessage.data = Buffer.alloc(0);

	parser.message = fakeMessage;

	parser.joinMessageData(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser.message.data, Buffer.alloc(0));

	// --------------------

	parser.client = false;

	parser.joinMessageData(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser.message.data, Buffer.alloc(0));

	// --------------------

	parser.frame.fin = true;

	parser.joinMessageData(() => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.message === null);

	test.end();
});

tap.test('WSParser.prototype.createMessage', (test) => {

	const parser = new WSParser(0, true);

	parser.frame = {
		data: Buffer.alloc(0),
		opcode: 1
	};

	parser.createMessage(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser.message, {
		data: Buffer.alloc(0),
		type: 'text'
	});

	// --------------------

	parser.frame.opcode = 2;

	parser.createMessage(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser.message, {
		data: Buffer.alloc(0),
		type: 'binary'
	});

	test.end();
});

tap.test('WSParser.prototype.emitControlFrame', (test) => {

	const parser = new WSParser(0, true);
	const fakeFrame = {};

	fakeFrame.opcode = 10;

	parser.frame = fakeFrame;

	parser.on('control', (frame) => {
		test.ok(frame === fakeFrame);
	});

	parser.emitControlFrame(() => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	fakeFrame.opcode = 9;

	parser.emitControlFrame(() => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	fakeFrame.data = Buffer.alloc(0);
	fakeFrame.opcode = 8;

	parser.emitControlFrame(() => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	fakeFrame.data = Buffer.from([0, 0, 0x80]);
	fakeFrame.opcode = 8;

	parser.emitControlFrame((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	test.end();
});

tap.test('WSParser.prototype.endFrameProcessing', (test) => {

	const parser = new WSParser(0, true);

	parser.frame = {
		data: Buffer.alloc(0),
		opcode: 1
	};

	parser.endFrameProcessing(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		expect: symbols.expectHeader,
		frame: null,
		message: {
			data: Buffer.alloc(0),
			type: 'text'
		}
	});

	// --------------------

	parser.frame = {
		data: Buffer.alloc(0),
		opcode: 0
	};

	parser.endFrameProcessing(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		expect: symbols.expectHeader,
		frame: null,
		message: {
			data: Buffer.alloc(0),
			type: 'text'
		}
	});

	// --------------------

	parser.frame = {
		data: Buffer.alloc(0),
		opcode: 10
	};

	parser.endFrameProcessing(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		expect: symbols.expectHeader,
		frame: null
	});

	// --------------------

	parser.frame = {
		data: Buffer.from([0, 0, 0x80]),
		opcode: 8
	};

	parser.endFrameProcessing((error) => {
		test.ok(error instanceof Error);
		test.ok(parser.expect === symbols.parsingFailed);
	});

	test.end();
});

tap.test('WSParser.prototype.parseHeader', (test) => {

	const parser = new WSParser(0, true);

	parser.parseHeader(0x81, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x81, 0x00]),
		bufferBytes: 1
	});

	// --------------------

	parser.parseHeader(0x81, (error) => {
		test.ok(error instanceof Error);
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.parsingFailed
	});

	// --------------------

	parser.buffer = Buffer.from([0x81, 0x00]);
	parser.bufferBytes = 1;
	parser.expect = symbols.expectHeader;

	parser.parseHeader(0x7E, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expect16BitLength
	});

	// --------------------

	parser.buffer = Buffer.from([0x81, 0x00]);
	parser.bufferBytes = 1;
	parser.expect = symbols.expectHeader;

	parser.parseHeader(0x7F, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expect64BitLength
	});

	// --------------------

	parser.buffer = Buffer.from([0x81, 0x00]);
	parser.bufferBytes = 1;
	parser.expect = symbols.expectHeader;

	parser.parseHeader(0x7D, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectData
	});

	// --------------------

	parser.buffer = Buffer.from([0x81, 0x00]);
	parser.bufferBytes = 1;
	parser.expect = symbols.expectHeader;

	parser.parseHeader(0x00, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectHeader
	});

	// --------------------

	parser.buffer = Buffer.from([0x81, 0x00]);
	parser.bufferBytes = 1;
	parser.client = false;

	parser.parseHeader(0x80, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectMask
	});

	test.end();
});

tap.test('WSParser.prototype.parse16BitLength', (test) => {

	const parser = new WSParser(0, true);

	parser.frame = {};

	parser.parse16BitLength(0x01);

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x00]),
		bufferBytes: 1
	});

	// --------------------

	parser.parse16BitLength(0x01);

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectData,
		frame: {
			length: 257
		}
	});

	// --------------------

	parser.buffer = Buffer.from([0x01, 0x00]);
	parser.bufferBytes = 1;
	parser.client = false;

	parser.parse16BitLength(0x01);

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectMask,
		frame: {
			length: 257
		}
	});

	test.end();
});

tap.test('WSParser.prototype.parse64BitLength', (test) => {

	const parser = new WSParser(0, true);

	parser.frame = {};

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
		bufferBytes: 1
	});

	// --------------------

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
		bufferBytes: 2
	});

	// --------------------

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]),
		bufferBytes: 3
	});

	// --------------------

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]),
		bufferBytes: 4
	});

	// --------------------

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00]),
		bufferBytes: 5
	});

	// --------------------

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00]),
		bufferBytes: 6
	});

	// --------------------

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00]),
		bufferBytes: 7
	});

	// --------------------

	parser.parse64BitLength(0x01, (error) => {
		test.ok(error instanceof Error);
	});

	test.ok(parser.expect === symbols.parsingFailed);

	// --------------------

	parser.buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00]);
	parser.bufferBytes = 7;

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectData
	});

	// --------------------

	parser.buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00]);
	parser.bufferBytes = 7;
	parser.client = false;

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectMask
	});

	test.end();
});

tap.test('WSParser.prototype.parseMask', (test) => {

	const parser = new WSParser(0, true);

	parser.frame = {};

	parser.parseMask(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x00, 0x00, 0x00]),
		bufferBytes: 1
	});

	// --------------------

	parser.parseMask(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x00, 0x00]),
		bufferBytes: 2
	});

	// --------------------

	parser.parseMask(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: Buffer.from([0x01, 0x01, 0x01, 0x00]),
		bufferBytes: 3
	});

	// --------------------

	parser.parseMask(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		frame: null
	});

	// --------------------

	parser.frame = {};
	parser.frame.length = 1;
	parser.buffer = Buffer.from([0x01, 0x01, 0x01, 0x00]);
	parser.bufferBytes = 3;

	parser.parseMask(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		expect: symbols.expectData
	});

	test.end();
});

tap.test('WSParser.prototype.parseByte', (test) => {

	const byte = 0x00;
	const parser = new WSParser(0, true);

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	parser.expect = symbols.expect16BitLength;
	parser.frame = {};

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	parser.expect = symbols.expect64BitLength;

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	// --------------------

	parser.expect = symbols.expectMask;

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	test.end();
});

tap.test('WSParser.prototype.getData', (test) => {

	const parser = new WSParser(1024, true);

	const callback = () => {
		test.fail('Callback function should not be called');
	};

	parser.frame = new Frame(Buffer.alloc(2));
	parser.message = {
		data: Buffer.alloc(0),
		type: 'text'
	};

	parser.getData(Buffer.alloc(0), 0, callback);

	// --------------------

	parser.frame = new Frame(Buffer.alloc(2));
	parser.frame.data = Buffer.alloc(1);

	parser.getData(Buffer.alloc(0), 0, callback);

	test.end();
});

tap.test('WSParser.prototype.write', (test) => {

	const parser = new WSParser(1024, true);

	parser.on('error', (error) => {
		test.ok(error instanceof Error);
	});

	parser.write(Buffer.alloc(1));

	// --------------------

	parser.expect = symbols.expectData;
	parser.frame = new Frame(Buffer.alloc(2));
	parser.message = {
		data: Buffer.alloc(0),
		type: 'text'
	};

	parser.write(Buffer.alloc(1));

	// --------------------

	parser.expect = symbols.expectHeader;

	parser.write(Buffer.from([0xFF, 0xFF]));

	test.ok(parser.expect === symbols.parsingFailed);

	test.end();
});