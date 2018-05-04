'use strict';

const sinon = require('sinon');
const tap = require('tap');

const WsFrame = require('simples/lib/ws/frame');

tap.test('WsFrame.create', (test) => {

	const frame = WsFrame.create(Buffer.from([0xFF, 0xFF]));

	test.match(frame, {
		data: Buffer.alloc(0),
		extension: true,
		fin: true,
		length: 0x7F,
		mask: null,
		masked: true,
		opcode: 0x0F
	});

	test.end();
});

tap.test('WsFrame.xor', (test) => {

	const randomByte = () => Math.round(Math.random() * 255);
	const initial = Buffer.from([randomByte(), randomByte(), randomByte(), randomByte()]);
	const buffer = Buffer.alloc(4);
	const mask = Buffer.from([randomByte(), randomByte(), randomByte(), randomByte()]);

	initial.copy(buffer);

	WsFrame.xor(buffer, mask, 0);

	for (let index = 0; index < 4; index++) {
		test.ok(buffer[index] ^ mask[index] === initial[index]);
	}

	test.end();
});

tap.test('WsFrame#appendData', (test) => {

	const sandbox = sinon.createSandbox();

	const frame = WsFrame.create(Buffer.from([0x00, 0x82]));

	frame.appendData(Buffer.from([0x01]));

	test.match(frame.data, Buffer.from([0x01]));

	// --------------------

	frame.mask = Buffer.from([0x00, 0x01, 0x02, 0x03]);

	sandbox.stub(WsFrame, 'xor');

	frame.appendData(Buffer.from([0x02]));

	test.match(frame.data, Buffer.from([0x01, 0x02]));
	test.ok(WsFrame.xor.withArgs(frame.data, frame.mask, 0).calledOnce);

	sandbox.restore();

	test.end();
});

tap.test('WsFrame.buffer', (test) => {

	let buffer = WsFrame.buffer({
		fin: true,
		masked: false,
		opcode: 0
	}, Buffer.alloc(1));

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 3);

	// --------------------

	buffer = WsFrame.buffer({
		fin: true,
		masked: true,
		opcode: 0
	}, Buffer.alloc(200));

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 208);

	test.end();
});

tap.test('WsFrame.close', (test) => {

	let buffer = WsFrame.close(0, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	// --------------------

	buffer = WsFrame.close(1000, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	// --------------------

	buffer = WsFrame.close(2000, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	test.end();
});

tap.test('WsFrame.ping', (test) => {

	const buffer = WsFrame.ping();

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 2);

	test.end();
});

tap.test('WsFrame.pong', (test) => {

	const buffer = WsFrame.pong({
		data: Buffer.alloc(0)
	}, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 2);

	test.end();
});

tap.test('WsFrame.wrap', (test) => {

	WsFrame.wrap(Buffer.alloc(200000), true, () => {
		test.pass('Callback function was called');
	});

	// --------------------

	WsFrame.wrap('', true, () => {
		test.pass('Callback function was called');
	});

	// --------------------

	WsFrame.wrap({}, true, () => {
		test.pass('Callback function was called');
	});

	test.end();
});