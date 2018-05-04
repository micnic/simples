'use strict';

const sinon = require('sinon');
const tap = require('tap');

const symbols = require('simples/lib/utils/symbols');
const WsParser = require('simples/lib/parsers/ws-parser');

const { Writable } = require('stream');

tap.test('WsParser.create', (test) => {

	const parser = WsParser.create(0, true);

	test.ok(parser instanceof WsParser);
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

tap.test('WsParser#readyBuffer', (test) => {

	const parser = WsParser.create(0, true);

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

tap.test('WsParser#resetBuffer', (test) => {

	const parser = WsParser.create(0, true);

	parser.buffer = Buffer.alloc(1);
	parser.bufferBytes = 1;

	parser.resetBuffer();

	test.match(parser, {
		buffer: null,
		bufferBytes: 0
	});

	test.end();
});

tap.test('WsParser#validateFrame', (test) => {

	const parser = WsParser.create(0, true);

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

tap.test('WsParser#emitMessage', (test) => {

	const parser = WsParser.create(0, true);
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

tap.test('WsParser#joinMessageData', (test) => {

	const parser = WsParser.create(0, true);
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

tap.test('WsParser#createMessage', (test) => {

	const parser = WsParser.create(0, true);

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

tap.test('WsParser#emitControlFrame', (test) => {

	const parser = WsParser.create(0, true);
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

tap.test('WsParser#endFrameProcessing', (test) => {

	const parser = WsParser.create(0, true);

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

tap.test('WsParser#parseHeader', (test) => {

	const parser = WsParser.create(0, true);

	parser.parseHeader(0x81, (error) => {
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

	sinon.stub(parser, 'endFrameProcessing');

	parser.parseHeader(0x00, () => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.endFrameProcessing.withArgs(sinon.match.func).calledOnce);
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

tap.test('WsParser#parse16BitLength', (test) => {

	const parser = WsParser.create(0, true);

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

tap.test('WsParser#parse64BitLength', (test) => {

	const parser = WsParser.create(0, true);

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

tap.test('WsParser#parseMask', (test) => {

	const parser = WsParser.create(0, true);

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

	sinon.stub(parser, 'endFrameProcessing');

	parser.parseMask(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.endFrameProcessing.withArgs(sinon.match.func).calledOnce);
	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		frame: {
			mask: Buffer.from([0x01, 0x01, 0x01, 0x01])
		}
	});

	// --------------------

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

tap.test('WsParser#parseByte', (test) => {

	const byte = 0x00;
	const parser = WsParser.create(0, true);

	sinon.stub(parser, 'parse16BitLength');
	sinon.stub(parser, 'parse64BitLength');
	sinon.stub(parser, 'parseMask');
	sinon.stub(parser, 'parseHeader');

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.parseHeader.withArgs(byte, sinon.match.func).calledOnce);

	// --------------------

	parser.expect = symbols.expect16BitLength;

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.parse16BitLength.withArgs(byte).calledOnce);

	// --------------------

	parser.expect = symbols.expect64BitLength;

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.parse64BitLength.withArgs(byte, sinon.match.func).calledOnce);

	// --------------------

	parser.expect = symbols.expectMask;

	parser.parseByte(byte, () => {
		test.fail('Callback function should not be called');
	});

	test.ok(parser.parseMask.withArgs(byte, sinon.match.func).calledOnce);

	test.end();
});

tap.test('WsParser#getData', (test) => {

	const parser = WsParser.create(1024, true);

	const callback = () => {
		test.fail('Callback function should not be called');
	};

	parser.frame = {
		appendData: sinon.stub(),
		data: Buffer.alloc(0),
		length: 1
	};

	sinon.stub(parser, 'endFrameProcessing');

	parser.getData(Buffer.alloc(0), 0, callback);

	test.ok(parser.frame.appendData.withArgs(sinon.match.instanceOf(Buffer)).calledOnce);

	// --------------------

	parser.frame.data = Buffer.alloc(1);

	parser.getData(Buffer.alloc(0), 0, callback);

	test.ok(parser.frame.appendData.calledTwice);
	test.ok(parser.endFrameProcessing.withArgs(callback).calledOnce);

	test.end();
});

tap.test('WsParser#write', (test) => {

	const parser = WsParser.create(1024, true);

	parser.on('error', (error) => {
		test.ok(error instanceof Error);
	});

	sinon.stub(parser, 'parseByte');

	parser.write(Buffer.alloc(1));

	test.ok(parser.parseByte.withArgs(0x00, sinon.match.func).calledOnce);

	// --------------------

	parser.expect = symbols.expectData;

	sinon.stub(parser, 'getData');

	parser.write(Buffer.alloc(1));

	test.ok(parser.getData.withArgs(sinon.match.instanceOf(Buffer), 0, sinon.match.func).calledOnce);

	// --------------------

	parser.expect = symbols.expectHeader;

	parser.parseByte.restore();
	sinon.stub(parser, 'parseByte').callsFake(() => {
		parser.expect = symbols.parsingFailed;
	}).callsArgWith(1, Error());

	parser.write(Buffer.alloc(1));

	test.ok(parser.expect === symbols.parsingFailed);
	test.ok(parser.parseByte.withArgs(0x00, sinon.match.func).calledOnce);

	test.end();
});