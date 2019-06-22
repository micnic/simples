'use strict';

const tap = require('tap');

const Frame = require('simples/lib/ws/frame');
const Random = require('simples/lib/utils/random');

tap.test('Frame.prototype.constructor()', (test) => {

	const frame = new Frame(Buffer.from([0xFF, 0xFF]));

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

tap.test('Frame.xor', (test) => {

	const mask = Random.randomBuffer(4);

	let initial = Random.randomBuffer(1);
	let buffer = Buffer.alloc(1);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 0);

	for (let index = 0; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[index] === initial[index]);
	}

	initial = Random.randomBuffer(2);
	buffer = Buffer.alloc(2);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 0);

	for (let index = 0; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[index] === initial[index]);
	}

	initial = Random.randomBuffer(3);
	buffer = Buffer.alloc(3);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 0);

	for (let index = 0; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[index] === initial[index]);
	}

	initial = Random.randomBuffer(4);
	buffer = Buffer.alloc(4);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 0);

	for (let index = 0; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[index] === initial[index]);
	}

	initial = Random.randomBuffer(5);
	buffer = Buffer.alloc(5);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 1);

	for (let index = 1; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[(index - 1) % 4] === initial[index]);
	}

	initial = Random.randomBuffer(6);
	buffer = Buffer.alloc(6);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 1);

	for (let index = 1; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[(index - 1) % 4] === initial[index]);
	}

	initial = Random.randomBuffer(7);
	buffer = Buffer.alloc(7);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 1);

	for (let index = 1; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[(index - 1) % 4] === initial[index]);
	}

	initial = Random.randomBuffer(8);
	buffer = Buffer.alloc(8);

	initial.copy(buffer);

	Frame.xor(buffer, mask, 1);

	for (let index = 1; index < buffer.length; index++) {
		test.ok(buffer[index] ^ mask[(index - 1) % 4] === initial[index]);
	}

	test.end();
});

tap.test('Frame.prototype.appendData()', (test) => {

	const frame = new Frame(Buffer.from([0x00, 0x82]));

	frame.appendData(Buffer.from([0x01]));

	test.match(frame.data, Buffer.from([0x01]));

	// --------------------

	frame.mask = Buffer.from([0x00, 0x01, 0x02, 0x03]);

	frame.appendData(Buffer.from([0x02]));

	test.match(frame.data, Buffer.from([0x01, 0x03]));

	test.end();
});

tap.test('Frame.buffer', (test) => {

	let buffer = Frame.buffer({
		fin: true,
		masked: false,
		opcode: 0
	}, Buffer.alloc(1));

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 3);

	// --------------------

	buffer = Frame.buffer({
		fin: true,
		masked: true,
		opcode: 0
	}, Buffer.alloc(200));

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 208);

	test.end();
});

tap.test('Frame.close', (test) => {

	let buffer = Frame.close(0, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	// --------------------

	buffer = Frame.close(1000, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	// --------------------

	buffer = Frame.close(2000, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 4);

	test.end();
});

tap.test('Frame.ping', (test) => {

	const buffer = Frame.ping();

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 2);

	test.end();
});

tap.test('Frame.pong', (test) => {

	const buffer = Frame.pong({
		data: Buffer.alloc(0)
	}, false);

	test.ok(Buffer.isBuffer(buffer));
	test.ok(buffer.length === 2);

	test.end();
});

tap.test('Frame.wrap', (test) => {

	Frame.wrap(Buffer.alloc(200000), true, () => {
		test.pass('Callback function was called');
	});

	// --------------------

	Frame.wrap('', true, () => {
		test.pass('Callback function was called');
	});

	// --------------------

	Frame.wrap({}, true, () => {
		test.pass('Callback function was called');
	});

	test.end();
});