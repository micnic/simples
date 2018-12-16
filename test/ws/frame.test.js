'use strict';

const tap = require('tap');

const WSFrame = require('simples/lib/ws/frame');

tap.test('WSFrame.create', (test) => {

	const frame = WSFrame.create(Buffer.from([0xFF, 0xFF]));

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

tap.test('WSFrame.xor', (test) => {

	const randomByte = () => Math.round(Math.random() * 255);
	const initial = Buffer.from([randomByte(), randomByte(), randomByte(), randomByte()]);
	const buffer = Buffer.alloc(4);
	const mask = Buffer.from([randomByte(), randomByte(), randomByte(), randomByte()]);

	initial.copy(buffer);

	WSFrame.xor(buffer, mask, 0);

	for (let index = 0; index < 4; index++) {
		test.ok(buffer[index] ^ mask[index] === initial[index]);
	}

	test.end();
});

tap.test('WSFrame.prototype.appendData()', (test) => {

	const frame = WSFrame.create(Buffer.from([0x00, 0x82]));

	frame.appendData(Buffer.from([0x01]));

	test.match(frame.data, Buffer.from([0x01]));

	// --------------------

	frame.mask = Buffer.from([0x00, 0x01, 0x02, 0x03]);

	frame.appendData(Buffer.from([0x02]));

	test.match(frame.data, Buffer.from([0x01, 0x03]));

	test.end();
});

tap.test('WSFrame.buffer', (test) => {

	let buffer = WSFrame.buffer({
		fin: true,
		masked: false,
		opcode: 0
	}, Buffer.alloc(1));

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 3);

	// --------------------

	buffer = WSFrame.buffer({
		fin: true,
		masked: true,
		opcode: 0
	}, Buffer.alloc(200));

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 208);

	test.end();
});

tap.test('WSFrame.close', (test) => {

	let buffer = WSFrame.close(0, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	// --------------------

	buffer = WSFrame.close(1000, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	// --------------------

	buffer = WSFrame.close(2000, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	test.end();
});

tap.test('WSFrame.ping', (test) => {

	const buffer = WSFrame.ping();

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 2);

	test.end();
});

tap.test('WSFrame.pong', (test) => {

	const buffer = WSFrame.pong({
		data: Buffer.alloc(0)
	}, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 2);

	test.end();
});

tap.test('WSFrame.wrap', (test) => {

	WSFrame.wrap(Buffer.alloc(200000), true, () => {
		test.pass('Callback function was called');
	});

	// --------------------

	WSFrame.wrap('', true, () => {
		test.pass('Callback function was called');
	});

	// --------------------

	WSFrame.wrap({}, true, () => {
		test.pass('Callback function was called');
	});

	test.end();
});