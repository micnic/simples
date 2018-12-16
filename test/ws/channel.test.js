'use strict';

const tap = require('tap');

const { EventEmitter } = require('events');
const WSChannel = require('simples/lib/ws/channel');
const WSConnection = require('simples/lib/ws/connection');
const WSFormatter = require('simples/lib/utils/ws-formatter');

tap.test('WSChannel.create()', (test) => {

	const fakeParentHost = {
		_advanced: false
	};

	const channel = WSChannel.create(fakeParentHost, 'name');

	test.ok(channel instanceof WSChannel);
	test.ok(channel instanceof EventEmitter);
	test.ok(channel.connections instanceof Set);
	test.ok(channel._advanced === false);
	test.ok(channel._host === fakeParentHost);
	test.ok(channel._name === 'name');

	test.end();
});

tap.test('WSChannel.prototype.bind()', (test) => {

	const fakeParentHost = {
		_options: {
			advanced: false
		}
	};

	const channel = new WSChannel(fakeParentHost);

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

		const connection = new WSConnection(fakeParentHost, fakeLocation, fakeRequest);

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

tap.test('WSChannel.prototype.bind()', (test) => {

	const fakeParentHost = {
		_options: {
			advanced: false
		}
	};

	const channel = new WSChannel(fakeParentHost);

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

		const connection = new WSConnection(fakeParentHost, fakeLocation, fakeRequest);

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

tap.test('WSChannel.prototype.close()', (test) => {

	const fakeParentHost = {
		_channels: new Map(),
		_options: {
			advanced: false
		}
	};

	const fakeLocation = {
		protocol: 'ws:'
	};

	const fakeRequest = {
		headers: []
	};

	const channel = new WSChannel(fakeParentHost, 'name');
	const connection = new WSConnection(fakeParentHost, fakeLocation, fakeRequest);

	fakeParentHost._channels.set('name', channel);

	channel.bind(connection);

	channel.on('close', () => {
		test.ok(channel.connections.size === 0);
		test.ok(fakeParentHost._channels.size === 0);
	});

	channel.close();

	test.end();
});

tap.test('WSChannel.prototype.broadcast()', (test) => {

	const fakeParentHost = {
		_advanced: false,
		_channels: new Map()
	};

	const channel = new WSChannel(fakeParentHost, 'name');

	test.ok(channel.broadcast('data') === channel);

	test.end();
});