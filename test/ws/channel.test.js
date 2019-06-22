'use strict';

const tap = require('tap');

const { EventEmitter } = require('events');
const Channel = require('simples/lib/ws/channel');
const WSConnection = require('simples/lib/ws/connection');

tap.test('Channel.prototype.constructor()', (test) => {

	const fakeParentHost = {
		_advanced: false
	};

	const channel = new Channel(fakeParentHost, 'name');

	test.ok(channel instanceof EventEmitter);
	test.ok(channel.connections instanceof Set);
	test.ok(channel._advanced === false);
	test.ok(channel._host === fakeParentHost);
	test.ok(channel._name === 'name');

	test.end();
});

tap.test('Channel.prototype.bind()', (test) => {

	const fakeParentHost = {
		_options: {
			advanced: false
		}
	};

	const channel = new Channel(fakeParentHost);

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

tap.test('Channel.prototype.bind()', (test) => {

	const fakeParentHost = {
		_options: {
			advanced: false
		}
	};

	const channel = new Channel(fakeParentHost);

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

tap.test('Channel.prototype.close()', (test) => {

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

	const channel = new Channel(fakeParentHost, 'name');
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

tap.test('Channel.prototype.broadcast()', (test) => {

	const fakeParentHost = {
		_advanced: false,
		_channels: new Map()
	};

	const channel = new Channel(fakeParentHost, 'name');

	test.ok(channel.broadcast('data') === channel);

	test.end();
});