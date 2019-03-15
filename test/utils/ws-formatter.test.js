'use strict';

const tap = require('tap');

const WSFormatter = require('simples/lib/utils/ws-formatter');

tap.test('WSFormatter.format()', (test) => {

	test.equal(WSFormatter.format(false, 'data'), 'data');
	test.equal(WSFormatter.format(true, 'event', 'data'), '{"data":"data","event":"event"}');

	test.end();
});