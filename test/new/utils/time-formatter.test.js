'use strict';

const tap = require('tap');

const TimeFormatter = require('simples/lib/utils/time-formatter');

tap.test('TimeFormatter.utcFormat()', (test) => {

	test.ok(TimeFormatter.utcFormat(0) === new Date().toUTCString());

	test.end();
});