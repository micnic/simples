'use strict';

const sinon = require('sinon');
const tap = require('tap');

const { EventEmitter } = require('events');

const WsFormatter = require('simples/lib/utils/ws-formatter');

tap.test('WsFormatter.format()', (test) => {

	let result = WsFormatter.format(false, '');

	test.ok(result === '');

	result = WsFormatter.format(true, 'event', 'data');

	test.match(JSON.parse(result), {
		data: 'data',
		event: 'event'
	});

	test.end();
});

tap.test('WsFormatter.broadcast()', (test) => {

	test.test('Advanced mode without filter', (t) => {

		const broadcaster = new EventEmitter();
		const fakeConnection = {};

		broadcaster._advanced = true;
		broadcaster.connections = new Set();

		broadcaster.connections.add(fakeConnection);

		fakeConnection.write = sinon.fake();

		broadcaster.on('broadcast', (event, data) => {
			t.ok(event === 'event');
			t.ok(data === 'data');
		});

		sinon.spy(WsFormatter, 'format');

		WsFormatter.broadcast(broadcaster, 'event', 'data');

		t.ok(WsFormatter.format.calledOnceWith(true, 'event', 'data'));
		t.ok(fakeConnection.write.calledOnceWith('{"data":"data","event":"event"}'));

		WsFormatter.format.restore();

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

		fakeConnection1.data = { id: 0 };
		fakeConnection2.data = { id: 1 };
		fakeConnection1.write = fakeConnection2.write = sinon.fake();

		broadcaster.on('broadcast', (data) => {
			t.equal(data, 'data');
		});

		sinon.spy(WsFormatter, 'format');

		WsFormatter.broadcast(broadcaster, 'data', null, (connection) => {

			return (connection.data.id % 2);
		});

		t.ok(WsFormatter.format.calledOnceWith(false, 'data'));
		t.ok(fakeConnection1.write.calledOnceWith('data'));

		WsFormatter.format.restore();

		t.end();
	});

	test.end();
});

tap.test('WsFormatter.send()', (test) => {

	test.test('Without callback', (t) => {

		const fakeSender = new EventEmitter();

		fakeSender._advanced = true;
		fakeSender.write = sinon.fake();

		sinon.spy(WsFormatter, 'format');

		WsFormatter.send(fakeSender, 'event', 'data');

		t.ok(WsFormatter.format.calledOnceWith(true, 'event', 'data'));
		t.ok(fakeSender.write.calledOnceWith('{"data":"data","event":"event"}'));

		WsFormatter.format.restore();

		t.end();
	});

	test.test('With callback', (t) => {

		const fakeSender = new EventEmitter();

		fakeSender._advanced = true;
		fakeSender.write = sinon.fake();

		sinon.spy(WsFormatter, 'format');

		WsFormatter.send(fakeSender, 'event', 'data', (response) => {
			t.equal(response, 'response');
		});

		fakeSender.emit('event', 'response');

		t.ok(WsFormatter.format.calledOnceWith(true, 'event', 'data'));
		t.ok(fakeSender.write.calledOnceWith('{"data":"data","event":"event"}'));

		WsFormatter.format.restore();

		t.end();
	});

	test.end();
});