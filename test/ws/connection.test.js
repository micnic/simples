'use strict';

const tap = require('tap');

const WSConnection = require('simples/lib/ws/connection');

tap.test('WSConnection.prototype.send()', (test) => {

	test.test('Simple mode without callback', (t) => {

		const connection = new WSConnection({ _options: { advanced: false } }, { protocol: 'ws:' }, { headers: [] });

		connection.write = (data) => {
			test.equal(data, 'data');
		};

		connection.send('data');

		t.end();
	});

	test.test('Advanced mode with callback', (t) => {

		const connection = new WSConnection({ _options: { advanced: true } }, { protocol: 'ws:' }, { headers: [] });

		connection.write = (data) => {
			test.equal(data, '{"data":"data","event":"event"}');
		};

		connection.send('event', 'data', (response) => {
			t.equal(response, 'response');
		});

		connection.emit('event', 'response');

		t.end();
	});

	test.end();
});