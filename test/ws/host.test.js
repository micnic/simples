'use strict';

const tap = require('tap');

const HTTPHost = require('simples/lib/http/host');
const WSChannel = require('simples/lib/ws/channel');
const WSConnection = require('simples/lib/ws/connection');
const WSHost = require('simples/lib/ws/host');

tap.test('WSHost.optionsContainer()', (test) => {

	test.match(WSHost.optionsContainer(), {
		advanced: false,
		limit: 1048576,
		origins: [],
		timeout: 30000
	});

	test.end();
});

tap.test('WSHost.create()', (test) => {

	test.test('Fixed host', (t) => {

		const httpHost = HTTPHost.create('hostname');
		const noopListener = () => null;

		const wsHost = WSHost.create(httpHost, '/', null, noopListener);

		t.ok(httpHost._routes.ws.fixed.size === 1);
		t.ok(httpHost._routes.ws.fixed.get('/') === wsHost);
		t.ok(wsHost.connections instanceof Set);
		t.ok(wsHost._channels instanceof Map);
		t.match(wsHost._options, WSHost.optionsContainer());
		t.ok(wsHost._advanced === false);
		t.ok(wsHost._parent === httpHost);
		t.ok(wsHost.dynamic === false);
		t.ok(wsHost.listener === noopListener);
		t.ok(wsHost.location === '/');

		t.end();
	});

	test.test('Dynamic host', (t) => {

		const httpHost = HTTPHost.create('hostname');
		const noopListener = () => null;

		const wsHost = WSHost.create(httpHost, '/*', null, noopListener);

		t.ok(httpHost._routes.ws.dynamic.size === 1);
		t.ok(httpHost._routes.ws.dynamic.get('/*') === wsHost);
		t.ok(wsHost.connections instanceof Set);
		t.ok(wsHost._channels instanceof Map);
		t.match(wsHost._options, WSHost.optionsContainer());
		t.ok(wsHost._advanced === false);
		t.ok(wsHost._parent === httpHost);
		t.ok(wsHost.dynamic === true);
		t.ok(wsHost.listener === noopListener);
		t.ok(wsHost.location === '/*');
		t.ok(Array.isArray(wsHost.keys));
		t.ok(wsHost.pattern instanceof RegExp);

		t.end();
	});

	test.end();
});

tap.test('WSHost.prototype.broadcast()', (test) => {

	const host = new WSHost();

	test.ok(host.broadcast('data') === host);

	test.end();
});

tap.test('WSHost.prototype.channel()', (test) => {

	const host = new WSHost();

	let newChannel = null;

	test.test('Empty input', (t) => {

		t.ok(host.channel() === null);

		t.end();
	});

	test.test('Create a new channel', (t) => {

		newChannel = host.channel('name');

		t.ok(host._channels.size === 1);
		t.ok(host._channels.get('name') === newChannel);
		t.ok(newChannel instanceof WSChannel);

		t.end();
	});

	test.test('Get an existing channel', (t) => {

		const channel = host.channel('name');

		t.ok(channel === newChannel);

		t.end();
	});

	test.test('Filter provided', (t) => {

		const fakeLocation = {
			protocol: 'ws:'
		};

		const fakeRequest = {
			headers: []
		};

		const firstConnection = new WSConnection(host, fakeLocation, fakeRequest);
		const secondConnection = new WSConnection(host, fakeLocation, fakeRequest);

		firstConnection.data.allowed = true;
		secondConnection.data.allowed = false;

		host.connections.add(firstConnection);
		host.connections.add(secondConnection);

		const channel = host.channel('name', (connection) => {

			return connection.data.allowed;
		});

		test.ok(channel.connections.size === 1);
		test.ok(channel.connections.has(firstConnection));

		t.end();
	});

	test.end();
});