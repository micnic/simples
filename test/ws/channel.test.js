'use strict';

const sinon = require('sinon');
const tap = require('tap');

const { EventEmitter } = require('events');
const WsChannel = require('simples/lib/ws/channel');
const WsConnection = require('simples/lib/ws/connection');
const WsUtils = require('simples/lib/utils/ws-utils');

tap.test('WsChannel.create()', (test) => {

	const fakeParentHost = {
		_advanced: false
	};

	const channel = WsChannel.create(fakeParentHost, 'name');

	test.ok(channel instanceof WsChannel);
	test.ok(channel instanceof EventEmitter);
	test.ok(channel.connections instanceof Set);
	test.ok(channel._advanced === false);
	test.ok(channel._host === fakeParentHost);
	test.ok(channel._name === 'name');

	test.end();
});

tap.test('WsChannel.prototype.bind()', (test) => {

	const fakeParentHost = {
		_advanced: false
	};

	const channel = new WsChannel(fakeParentHost);

	test.test('Empty input', (t) => {
		channel.bind();

		t.ok(channel.connections.size === 0);

		t.end();
	});

	test.test('Bind connection', (t) => {

		const fakeLocation = {
			protocol: 'ws:'
		};

		const fakeRequest = {
			headers: []
		};

		const connection = new WsConnection(fakeParentHost, fakeLocation, fakeRequest);

		channel.on('bind', (conn) => {
			t.ok(connection === conn);
		});

		channel.bind(connection);

		t.ok(channel.connections.size === 1);
		t.ok(channel.connections.has(connection));
		t.ok(connection._channels.size === 1);
		t.ok(connection._channels.has(channel));

		t.end();
	});

	test.end();
});

tap.test('WsChannel.prototype.bind()', (test) => {

	const fakeParentHost = {
		_advanced: false
	};

	const channel = new WsChannel(fakeParentHost);

	test.test('Empty input', (t) => {
		channel.unbind();

		t.ok(channel.connections.size === 0);

		t.end();
	});

	test.test('Bind connection', (t) => {

		const fakeLocation = {
			protocol: 'ws:'
		};

		const fakeRequest = {
			headers: []
		};

		const connection = new WsConnection(fakeParentHost, fakeLocation, fakeRequest);

		channel.bind(connection);

		channel.on('unbind', (conn) => {
			t.ok(connection === conn);
		});

		channel.unbind(connection);

		t.ok(channel.connections.size === 0);
		t.ok(connection._channels.size === 0);

		t.end();
	});

	test.end();
});

tap.test('WsChannel.prototype.close()', (test) => {

	const fakeParentHost = {
		_advanced: false,
		_channels: new Map()
	};

	const fakeLocation = {
		protocol: 'ws:'
	};

	const fakeRequest = {
		headers: []
	};

	const channel = new WsChannel(fakeParentHost, 'name');
	const connection = new WsConnection(fakeParentHost, fakeLocation, fakeRequest);

	fakeParentHost._channels.set('name', channel);

	channel.bind(connection);

	channel.on('close', () => {
		test.ok(channel.connections.size === 0);
		test.ok(fakeParentHost._channels.size === 0);
	});

	channel.close();

	test.end();
});

tap.test('WsChannel.prototype.broadcast()', (test) => {

	const fakeParentHost = {
		_advanced: false,
		_channels: new Map()
	};

	const channel = new WsChannel(fakeParentHost, 'name');

	sinon.spy(WsUtils, 'broadcast');

	test.ok(channel.broadcast('data') === channel);
	test.ok(WsUtils.broadcast.calledOnce);

	WsUtils.broadcast.restore();

	test.end();
});