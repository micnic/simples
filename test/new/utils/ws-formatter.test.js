'use strict';

const tap = require('tap');

const WsFormatter = require('simples/lib/utils/ws-formatter');

tap.test('WsFormatter.format', (test) => {

	let result = WsFormatter.format(false, '');

	test.ok(result === '');

	result = WsFormatter.format(true, 'event', 'data');

	test.match(JSON.parse(result), {
		data: 'data',
		event: 'event'
	});

	test.end();
});