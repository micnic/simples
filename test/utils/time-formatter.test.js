'use strict';

const tap = require('tap');

const TimeFormatter = require('simples/lib/utils/time-formatter');

tap.test('TimeFormatter.toTwoDigits()', (test) => {

	test.equal(TimeFormatter.toTwoDigits(0), '00');
	test.equal(TimeFormatter.toTwoDigits(1), '01');
	test.equal(TimeFormatter.toTwoDigits(10), '10');

	test.end();
});

tap.test('TimeFormatter.utcFormat()', (test) => {

	test.equal(TimeFormatter.utcFormat(0), new Date().toUTCString());

	test.end();
});