'use strict';

const { PassThrough } = require('stream');
const tap = require('tap');
const zlib = require('zlib');

const StreamUtils = require('simples/lib/utils/stream-utils');

const createStream = (encoding) => {

	const stream = new PassThrough();

	stream.headers = {
		'content-encoding': encoding
	};

	return stream;
};

tap.test('StreamUtils.toBuffer()', (test) => {

	test.test('Collected buffer', (t) => {

		const stream = createStream();

		StreamUtils.toBuffer(stream).then((buffer) => {

			t.equal(Buffer.compare(buffer, Buffer.from('data')), 0);

			t.end();
		});

		stream.write('d');
		stream.write('a');
		stream.write('t');
		stream.end('a');
	});

	test.test('Error emitted', (t) => {

		const stream = createStream();
		const someError = Error('Some error');

		StreamUtils.toBuffer(stream).catch((error) => {

			t.equal(someError, error);

			t.end();
		});

		stream.emit('error', someError);
	});

	test.test('Exceeded limit', (t) => {

		const stream = createStream();

		StreamUtils.toBuffer(stream, 1).catch((error) => {

			t.ok(error instanceof Error);

			t.end();
		});

		stream.end(Buffer.from('data'));
	});

	test.end();
});

tap.test('StreamUtils.toString()', (test) => {

	test.test('Valid string', (t) => {

		const stream = createStream();

		StreamUtils.toString(stream).then((string) => {

			t.equal(string, 'data');

			t.end();
		});

		stream.end(Buffer.from('data'));
	});

	test.test('Invalid string', (t) => {

		const stream = createStream();
		const buffer = Buffer.from('data');

		buffer[1] = 0xFF;

		StreamUtils.toString(stream).catch((error) => {

			t.ok(error instanceof Error);

			t.end();
		});

		stream.end(buffer);
	});

	test.end();
});

tap.test('StreamUtils.decodeBuffer()', (test) => {

	test.test('No encoding', (t) => {

		const stream = createStream();

		StreamUtils.decodeBuffer(stream).then((buffer) => {

			t.equal(Buffer.compare(buffer, Buffer.from('data')), 0);

			t.end();
		});

		stream.end(Buffer.from('data'));
	});

	test.test('Valid deflate stream', (t) => {

		const stream = createStream('deflate');

		StreamUtils.decodeBuffer(stream).then((buffer) => {

			t.equal(Buffer.compare(buffer, Buffer.from('data')), 0);

			t.end();
		});

		zlib.deflate('data', (error, result) => {
			stream.end(result);
		});
	});

	test.test('Invalid deflate stream', (t) => {

		const stream = createStream('deflate');

		StreamUtils.decodeBuffer(stream).catch((error) => {

			t.ok(error instanceof Error);

			t.end();
		});

		stream.end(Buffer.from([0]));
	});

	test.test('Valid gzip stream', (t) => {

		const stream = createStream('gzip');

		StreamUtils.decodeBuffer(stream).then((buffer) => {

			t.equal(Buffer.compare(buffer, Buffer.from('data')), 0);

			t.end();
		});

		zlib.gzip('data', (error, result) => {
			stream.end(result);
		});
	});

	test.test('Invalid gzip stream', (t) => {

		const stream = createStream('gzip');

		StreamUtils.decodeBuffer(stream).catch((error) => {

			t.ok(error instanceof Error);

			t.end();
		});

		stream.end(Buffer.from([0]));
	});

	test.end();
});

tap.test('StreamUtils.parseJSON()', (test) => {

	test.test('Valid JSON data', (t) => {

		const stream = createStream();

		StreamUtils.parseJSON(stream).then((object) => {

			t.equal(object, null);

			t.end();
		});

		stream.end('null');
	});

	test.test('Invalid JSON data', (t) => {

		const stream = createStream();

		StreamUtils.parseJSON(stream).catch((error) => {

			t.ok(error instanceof Error);

			t.end();
		});

		stream.end('');
	});

	test.end();
});

tap.test('StreamUtils.parseQS()', (test) => {

	const stream = createStream();

	StreamUtils.parseQS(stream).then((object) => {

		test.match(object, {
			key: 'value'
		});

		test.end();
	});

	stream.end('key=value');
});

tap.test('StreamUtils.getEncoding', (test) => {

	test.equal(StreamUtils.getEncoding('Deflate'), 'deflate');
	test.equal(StreamUtils.getEncoding('GZIP'), 'gzip');
	test.equal(StreamUtils.getEncoding(), '');

	test.end();
});