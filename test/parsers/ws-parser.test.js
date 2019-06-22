'use strict';

const tap = require('tap');

const Frame = require('simples/lib/ws/frame');
const WSParser = require('simples/lib/parsers/ws-parser');
const { Writable } = require('stream');

const { states: {
	expect16BitLength,
	expect64BitLength,
	expectData,
	expectHeader,
	expectMask,
	parsingFailed
} } = WSParser;

tap.test('WSParser.prototype.constructor()', (test) => {

	const parser = new WSParser(0, false);

	test.ok(parser instanceof Writable);
	test.match(parser, {
		buffer: null,
		bufferBytes: 0,
		client: false,
		expect: expectHeader,
		frame: null,
		limit: 0,
		message: null
	});

	test.end();
});

tap.test('WSParser.prototype.readyBuffer()', (test) => {

	const parser = new WSParser(0, false);

	test.equal(parser.readyBuffer(2, 0xFF), false);

	test.match(parser, {
		buffer: Buffer.from([0xFF, 0x00]),
		bufferBytes: 1
	});

	test.equal(parser.readyBuffer(2, 0xFF), true);

	test.match(parser, {
		buffer: Buffer.from([0xFF, 0xFF]),
		bufferBytes: 2
	});

	test.end();
});

tap.test('WSParser.prototype.resetBuffer()', (test) => {

	const parser = new WSParser(0, false);

	parser.readyBuffer(1, 0x00);

	parser.resetBuffer();

	test.match(parser, {
		buffer: null,
		bufferBytes: 0
	});

	test.end();
});

tap.test('WSParser.prototype.validateFrame()', (test) => {

	test.test('Valid frame', (t) => {

		const parser = new WSParser(0, false);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 1
		}, Buffer.alloc(0));

		parser.frame = new Frame(buffer);

		t.ok(parser.validateFrame(() => {
			t.fail('Callback should not be called');
		}));

		t.end();
	});

	test.test('Frame with extensions flag set', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 1
		}, Buffer.alloc(0));

		let errorEmitted = false;

		buffer[0] |= 0x70;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Invalid continuation frame', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 0
		}, Buffer.alloc(0));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Continuation frame expected', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 1
		}, Buffer.alloc(0));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		parser.message = {
			data: Buffer.alloc(0),
			type: 'text'
		};

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Unknown frame type', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 3
		}, Buffer.alloc(0));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Invalid control frame with extended length', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 8
		}, Buffer.alloc(126));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Invalid control frame without fin flag', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: false,
			masked: true,
			opcode: 8
		}, Buffer.alloc(0));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Masked frame received from the server', (t) => {

		const parser = new WSParser(0, true);
		const buffer = Frame.buffer({
			fin: true,
			masked: true,
			opcode: 1
		}, Buffer.alloc(0));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.test('Unmasked frame received from the client', (t) => {

		const parser = new WSParser(0, false);
		const buffer = Frame.buffer({
			fin: true,
			masked: false,
			opcode: 1
		}, Buffer.alloc(0));

		let errorEmitted = false;

		parser.frame = new Frame(buffer);

		t.ok(!parser.validateFrame((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		}));

		t.ok(errorEmitted);

		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.end();
});

tap.test('WSParser.prototype.emitMessage()', (test) => {

	test.test('Binary message', (t) => {

		const parser = new WSParser(0, false);

		const message = parser.message = {
			data: Buffer.from([0]),
			type: 'binary'
		};

		let messageEmitted = false;

		parser.once('message', (m) => {
			t.equal(m, message);
			messageEmitted = true;
		});

		parser.emitMessage(() => {
			t.fail('Callback should not be called');
		});

		t.equal(parser.message, null);
		t.ok(messageEmitted);

		t.end();
	});

	test.test('Text message', (t) => {

		const parser = new WSParser(0, false);

		const message = parser.message = {
			data: Buffer.from([32]),
			type: 'text'
		};

		let messageEmitted = false;

		parser.once('message', (m) => {
			t.equal(m, message);
			t.equal(m.data, ' ');
			messageEmitted = true;
		});

		parser.emitMessage(() => {
			t.fail('Callback should not be called');
		});

		t.equal(parser.message, null);
		t.ok(messageEmitted);

		t.end();
	});

	test.test('Text message with invalid UTF8 data', (t) => {

		const parser = new WSParser(0, false);

		let errorEmitted = false;

		parser.message = {
			data: Buffer.from([128]),
			type: 'text'
		};

		parser.once('message', () => {
			t.fail('Message should not be emitted');
		});

		parser.emitMessage((error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		});

		t.ok(errorEmitted);
		t.equal(parser.message, null);
		t.equal(parser.expect, parsingFailed);

		t.end();
	});

	test.end();
});

tap.test('WSParser.prototype.joinMessageData()', (test) => {

	const parser = new WSParser(0, false);

	let messageEmitted = false;

	let data = Buffer.from([0]);

	parser.frame = new Frame(Frame.buffer({
		fin: false,
		masked: false,
		opcode: 2
	}, data));

	parser.message = {
		data: Buffer.alloc(0),
		type: 'binary'
	};

	parser.frame.appendData(data);

	parser.on('message', (message) => {
		test.ok(message === parser.message);
		test.match(message.data, Buffer.from([0, 1]));
		messageEmitted = true;
	});

	parser.joinMessageData(() => {
		test.fail('Callback should not be called');
	});

	test.match(parser.message.data, Buffer.from([0]));

	data = Buffer.from([1]);

	parser.frame = new Frame(Frame.buffer({
		fin: true,
		masked: false,
		opcode: 2
	}, data));

	parser.frame.appendData(data);

	parser.joinMessageData(() => {
		test.fail('Callback should not be called');
	});

	test.ok(messageEmitted);

	test.end();
});

tap.test('WSParser.prototype.createMessage()', (test) => {

	const parser = new WSParser(0, false);

	parser.frame = new Frame(Frame.buffer({
		fin: false,
		masked: false,
		opcode: 1
	}, Buffer.alloc(0)));

	parser.createMessage(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser.message, {
		data: Buffer.alloc(0),
		type: 'text'
	});

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

tap.test('WSParser.prototype.emitControlFrame()', (test) => {

	const parser = new WSParser(0, false);

	let controlEmitted = 0;
	let errorEmitted = false;

	parser.frame = new Frame(Frame.ping());

	parser.on('control', (frame) => {
		test.ok(frame === parser.frame);
		controlEmitted++;
	});

	parser.emitControlFrame(() => {
		test.fail('Callback function should not be called');
	});

	let data = Buffer.alloc(0);

	parser.frame = new Frame(Frame.buffer({
		fin: false,
		masked: false,
		opcode: 8
	}, data));

	parser.frame.appendData(data);

	parser.emitControlFrame(() => {
		test.fail('Callback function should not be called');
	});

	data = Buffer.from([0x03, 0xE8, 0x80]);

	parser.frame = new Frame(Frame.buffer({
		fin: false,
		masked: false,
		opcode: 8
	}, data));

	parser.frame.appendData(data);

	parser.emitControlFrame((error) => {
		test.ok(error instanceof Error);
		errorEmitted = true;
	});

	test.equal(controlEmitted, 2);
	test.ok(errorEmitted);

	test.equal(parser.expect, parsingFailed);

	test.end();
});

tap.test('WSParser.prototype.endFrameProcessing()', (test) => {

	const parser = new WSParser(0, false);

	parser.frame = {
		data: Buffer.alloc(0),
		opcode: 1
	};

	parser.endFrameProcessing(() => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		expect: expectHeader,
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
		expect: expectHeader,
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
		expect: expectHeader,
		frame: null
	});

	// --------------------

	parser.frame = {
		data: Buffer.from([0, 0, 0x80]),
		opcode: 8
	};

	parser.endFrameProcessing((error) => {
		test.ok(error instanceof Error);
	});

	test.match(parser, {
		expect: parsingFailed,
		frame: null
	});

	test.end();
});

tap.test('WSParser.prototype.parseHeader()', (test) => {

	test.test('Invalid header', (t) => {

		const parser = new WSParser(0, false);

		let errorEmitted = false;

		parser.parseHeader(0x00, () => {
			t.fail('Callback function should not be called');
		});

		t.match(parser, {
			buffer: Buffer.from([0x00, 0x00]),
			bufferBytes: 1
		});

		parser.parseHeader(0x00, (error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		});

		t.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.ok(errorEmitted);

		t.end();
	});

	test.test('Too long message', (t) => {

		const parser = new WSParser(1, false);

		let errorEmitted = false;

		parser.message = {
			data: Buffer.alloc(0)
		};

		parser.parseHeader(0x80, () => {
			t.fail('Callback function should not be called');
		});

		parser.parseHeader(0x82, (error) => {
			t.ok(error instanceof Error);
			errorEmitted = true;
		});

		t.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.ok(errorEmitted);

		t.end();
	});

	test.test('Header that expects mask after', (t) => {

		const parser = new WSParser(0, false);

		parser.parseHeader(0x81, () => {
			test.fail('Callback function should not be called');
		});

		parser.parseHeader(0x80, () => {
			test.fail('Callback function should not be called');
		});

		test.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.end();
	});

	test.test('Header that expects 16bit length after', (t) => {

		const parser = new WSParser(0, false);

		parser.parseHeader(0x81, () => {
			test.fail('Callback function should not be called');
		});

		parser.parseHeader(0xFE, () => {
			test.fail('Callback function should not be called');
		});

		test.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.end();
	});

	test.test('Header that expects 64bit length after', (t) => {

		const parser = new WSParser(0, false);

		parser.parseHeader(0x81, () => {
			test.fail('Callback function should not be called');
		});

		parser.parseHeader(0xFF, () => {
			test.fail('Callback function should not be called');
		});

		test.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.end();
	});

	test.test('Header of frame without content in client', (t) => {

		const parser = new WSParser(0, true);

		parser.parseHeader(0x81, () => {
			test.fail('Callback function should not be called');
		});

		parser.parseHeader(0x00, () => {
			test.fail('Callback function should not be called');
		});

		test.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.end();
	});

	test.test('Header of frame with content in client', (t) => {

		const parser = new WSParser(0, true);

		parser.parseHeader(0x81, () => {
			test.fail('Callback function should not be called');
		});

		parser.parseHeader(0x01, () => {
			test.fail('Callback function should not be called');
		});

		test.match(parser, {
			buffer: null,
			bufferBytes: 0
		});

		t.end();
	});

	test.end();
});

tap.test('WSParser.prototype.parse16BitLength()', (test) => {

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
		frame: {
			length: 257
		}
	});

	test.end();
});

tap.test('WSParser.prototype.parse64BitLength()', (test) => {

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

	// --------------------

	parser.buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00]);
	parser.bufferBytes = 7;

	parser.parse64BitLength(0x01, () => {
		test.fail('Callback function should not be called');
	});

	test.match(parser, {
		buffer: null,
		bufferBytes: 0
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
		bufferBytes: 0
	});

	test.end();
});

tap.test('WSParser.prototype.parseMask()', (test) => {

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
		bufferBytes: 0
	});

	test.end();
});

tap.test('WSParser.prototype.parseByte()', (test) => {

	test.test('Parse masked 16bit length frame', (t) => {

		const parser = new WSParser(0, false);

		parser.parseByte(0x81, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectHeader);

		parser.parseByte(0xFE, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect16BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect16BitLength);

		parser.parseByte(0xFF, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectMask);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectMask);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectMask);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectMask);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectData);

		t.end();
	});

	test.test('Parse unmasked 64bit length frame', (t) => {

		const parser = new WSParser(0, true);

		parser.parseByte(0x81, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectHeader);

		parser.parseByte(0x7F, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0x00, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expect64BitLength);

		parser.parseByte(0xFF, () => {
			test.fail('Callback function should not be called');
		});

		t.equal(parser.expect, expectData);

		t.end();
	});

	test.end();
});

tap.test('WSParser.prototype.getData()', (test) => {

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

tap.test('WSParser.prototype.write()', (test) => {

	const parser = new WSParser(0, false);

	let errorEmitted = false;
	let messageEmitted = false;

	parser.on('message', (message) => {
		test.match(message, {
			data: 'data',
			type: 'text'
		});
		messageEmitted = true;
	}).on('error', (error) => {
		test.ok(error instanceof Error);
		errorEmitted = true;
	});

	parser.write(Frame.buffer({
		fin: true,
		masked: true,
		opcode: 1,
	}, Buffer.from('data')));

	parser.write(Buffer.from([0x80, 0x80]));

	test.ok(messageEmitted);
	test.ok(errorEmitted);

	test.end();
});