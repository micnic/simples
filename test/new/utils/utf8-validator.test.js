'use strict';

const tap = require('tap');

const Utf8Validator = require('simples/lib/utils/utf8-validator');

tap.test('Utf8Validator.validate', (test) => {

	const emptyBuffer = Buffer.alloc(0);

	test.ok(Utf8Validator.validate(emptyBuffer));

	// --------------------

	test.ok(Utf8Validator.validate(Buffer.from([0x00])));

	// --------------------

	test.ok(!Utf8Validator.validate(Buffer.from([0x80])));

	// --------------------

	let failed = false;

	for (let a = 0; !failed && a < 256; a++) {
		for (let b = 0; !failed && b < 256; b += 8) {
			for (let c = 0; !failed && c < 256; c += 8) {
				for (let d = 0; !failed && d < 256; d += 8) {

					const buffer = Buffer.from([a, b, c, d]);
					const isUtf8Valid = (Buffer.compare(buffer, Buffer.from(String(buffer))) === 0);

					if (Utf8Validator.validate(buffer) !== isUtf8Valid) {
						test.fail('All provided buffers must return the same result as Buffer.compare() method');
						failed = true;
					}
				}
			}
		}
	}

	test.end();
});