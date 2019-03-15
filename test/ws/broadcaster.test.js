'use strict';

const tap = require('tap');

const Broadcaster = require('simples/lib/ws/broadcaster');

tap.test('Broadcaster.prototype.constructor()', (test) => {

	const broadcaster = new Broadcaster(false);

	test.ok(broadcaster.connections instanceof Set);
	test.equal(broadcaster._advanced, false);

	test.end();
});

tap.test('Broadcaster.prototype.broadcast()', (test) => {

	test.test('Simple mode without filter', (t) => {

		const broadcaster = new Broadcaster(false);
		const fakeConnection = {};

		broadcaster.connections.add(fakeConnection);

		fakeConnection.write = () => null;

		broadcaster.on('broadcast', (data) => {
			t.equal(data, 'data');
		});

		broadcaster.broadcast('data');

		t.end();
	});

	test.test('Advanced mode with filter', (t) => {

		const broadcaster = new Broadcaster(true);
		const fakeConnection1 = {};
		const fakeConnection2 = {};

		broadcaster.connections.add(fakeConnection1);
		broadcaster.connections.add(fakeConnection2);

		fakeConnection1.write = () => null;
		fakeConnection2.write = () => null;

		fakeConnection1.data = { id: 0 };
		fakeConnection2.data = { id: 1 };

		broadcaster.on('broadcast', (event, data) => {
			t.equal(event, 'event');
			t.equal(data, 'data');
		});

		broadcaster.broadcast('event', 'data', (connection) => {

			return (connection.data.id % 2);
		});

		t.end();
	});

	test.end();
});