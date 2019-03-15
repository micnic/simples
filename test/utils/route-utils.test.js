'use strict';

const tap = require('tap');

const RouteUtils = require('simples/lib/utils/route-utils');

tap.test('RouteUtils.escapeRegExpString', (test) => {

	test.ok(RouteUtils.escapeRegExpString('-[]/{}()+?.\\^$|') === '\\-\\[\\]\\/\\{\\}\\(\\)\\+\\?\\.\\\\\\^\\$\\|');

	test.end();
});

tap.test('RouteUtils.isDynamic()', (test) => {

	test.ok(!RouteUtils.isDynamic('/path/to/route'));
	test.ok(RouteUtils.isDynamic('/:param/*'));

	test.end();
});