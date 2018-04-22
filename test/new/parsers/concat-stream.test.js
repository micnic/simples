'use strict';

const tap = require('tap');

const ConcatStream = require('simples/lib/parsers/concat-stream');

const { Transform } = require('stream');
const { StringDecoder } = require('string_decoder');

const dataString = 'ĂÂÎȘȚ';
const dataBuffer = Buffer.from(dataString);

tap.test('ConcatStream.prototype.constructor()', (test) => {

	const concatStream = new ConcatStream();

	test.ok(concatStream instanceof ConcatStream);
	test.ok(concatStream instanceof Transform);
	test.ok(concatStream.buffer === '');
	test.ok(concatStream.decoder instanceof StringDecoder);

	test.end();
});

tap.test('ConcatStream.prototype.end()', (test) => {

	test.test('Valid data', (t) => {

		const concatStream = new ConcatStream();

		concatStream.pushResult = (callback) => {

			t.ok(concatStream.buffer === dataString);

			callback(null);
		};

		concatStream.end(dataString);

		t.end();
	});

	test.test('Invalid data', (t) => {

		const concatStream = new ConcatStream();

		concatStream.pushResult = () => {
			t.fail('.pushResult() should not be called');
		};

		concatStream.on('error', (error) => {
			t.ok(error instanceof Error);
		});

		concatStream.end(dataBuffer.slice(0, -1));

		t.end();
	});

	test.end();
});

tap.test('ConcatStream.prototype.write()', (test) => {

	test.test('Write string', (t) => {

		const concatStream = new ConcatStream();

		for (const char of dataString) {
			concatStream.write(char);
		}

		t.ok(concatStream.buffer === dataString);

		t.end();
	});

	test.test('Write buffer', (t) => {

		const concatStream = new ConcatStream();

		for (const byte of dataBuffer) {
			concatStream.write(Buffer([byte]));
		}

		t.ok(concatStream.buffer === dataString);

		t.end();
	});

	test.end();
});