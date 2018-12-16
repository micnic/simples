'use strict';

const { EventEmitter } = require('events');
const tap = require('tap');

const WSFormatter = require('simples/lib/utils/ws-formatter');

tap.test('WSFormatter.format()', (test) => {

	let result = WSFormatter.format(false, '');

	test.ok(result === '');

	result = WSFormatter.format(true, 'event', 'data');

	test.match(JSON.parse(result), {
		data: 'data',
		event: 'event'
	});

	test.end();
});

tap.test('WSFormatter.broadcast()', (test) => {

	test.test('Advanced mode without filter', (t) => {

		const broadcaster = new EventEmitter();
		const fakeConnection = {};

		broadcaster._advanced = true;
		broadcaster.connections = new Set();

		broadcaster.connections.add(fakeConnection);

		fakeConnection.write = () => null;

		broadcaster.on('broadcast', (event, data) => {
			t.ok(event === 'event');
			t.ok(data === 'data');
		});

		WSFormatter.broadcast(broadcaster, 'event', 'data');

		t.end();
	});

	test.test('Simple mode with filter', (t) => {

		const broadcaster = new EventEmitter();
		const fakeConnection1 = {};
		const fakeConnection2 = {};

		broadcaster._advanced = false;
		broadcaster.connections = new Set();

		broadcaster.connections.add(fakeConnection1);
		broadcaster.connections.add(fakeConnection2);

		fakeConnection1.write = () => null;
		fakeConnection2.write = () => null;

		fakeConnection1.data = { id: 0 };
		fakeConnection2.data = { id: 1 };

		broadcaster.on('broadcast', (data) => {
			t.equal(data, 'data');
		});

		WSFormatter.broadcast(broadcaster, 'data', null, (connection) => {

			return (connection.data.id % 2);
		});

		t.end();
	});

	test.end();
});

tap.test('WSFormatter.send()', (test) => {

	test.test('Without callback', (t) => {

		const fakeSender = new EventEmitter();

		fakeSender._advanced = true;
		fakeSender.write = () => null;

		WSFormatter.send(fakeSender, 'event', 'data');

		t.end();
	});

	test.test('With callback', (t) => {

		const fakeSender = new EventEmitter();

		fakeSender._advanced = true;
		fakeSender.write = () => null;

		WSFormatter.send(fakeSender, 'event', 'data', (response) => {
			t.equal(response, 'response');
		});

		fakeSender.emit('event', 'response');

		t.end();
	});

	test.end();
});