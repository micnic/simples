'use strict';

const tap = require('tap');

const WSSender = require('simples/lib/utils/ws-sender');
const TestUtils = require('simples/test/test-utils');
const { PassThrough, Writable } = require('stream');

tap.test('WSSender.closeConnection()', (test) => {

	test.test('Close connection without status code', (t) => {

		const connection = new Writable();

		WSSender.closeConnection(connection, () => {
			t.end();
		});
	});

	test.test('Close connection with status code', (t) => {

		const connection = new Writable();

		WSSender.closeConnection(connection, 1000, () => {

			t.equal(connection._status, 1000);

			t.end();
		});
	});

	test.test('Only status code provided', (t) => {

		const connection = new Writable();

		WSSender.closeConnection(connection, 1000);

		t.equal(connection._status, 1000);

		t.end();
	});

	test.test('No arguments provided', (t) => {

		const connection = new Writable();

		WSSender.closeConnection(connection);

		t.end();
	});

	test.end();
});

tap.test('WSSender.format()', (test) => {

	test.equal(WSSender.format(false, 'data'), 'data');
	test.equal(WSSender.format(true, 'event', 'data'), '{"data":"data","event":"event"}');

	test.end();
});

tap.test('WSSender.send()', (test) => {

	test.test('Simple mode', (t) => {

		const connection = new PassThrough();

		connection._advanced = false;

		connection.on('data', (data) => {
			t.equal(data.toString(), 'data');
			t.end();
		});

		WSSender.send(connection, 'data');
	});

	test.test('Advanced mode with callback', (t) => {

		const connection = new PassThrough();

		connection._advanced = true;

		connection.on('data', (data) => {
			t.equal(data.toString(), '{"data":"data","event":"event"}');
			TestUtils.callAsync(() => {
				connection.emit('event', 'response');
			});
		});

		WSSender.send(connection, 'event', 'data', (response) => {
			t.equal(response, 'response');
			t.end();
		});
	});

	test.end();
});