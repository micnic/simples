'use strict';

const sinon = require('sinon');
const tap = require('tap');

const Config = require('simples/lib/utils/config');
const HttpHost = require('simples/lib/http/host');
const WsChannel = require('simples/lib/ws/channel');
const WsConnection = require('simples/lib/ws/connection');
const WsFormatter = require('simples/lib/utils/ws-formatter');
const WsHost = require('simples/lib/ws/host');

tap.test('WsHost.optionsContainer()', (test) => {

	sinon.spy(Config, 'getConfig');

	test.match(WsHost.optionsContainer(), {
		advanced: false,
		limit: 1048576,
		origins: [],
		timeout: 30000
	});
	test.ok(Config.getConfig.calledOnce);

	Config.getConfig.restore();

	test.end();
});

tap.test('WsHost.create()', (test) => {

	test.test('Fixed host', (t) => {

		const httpHost = new HttpHost();
		const noopListener = () => null;

		const wsHost = WsHost.create(httpHost, '/', null, noopListener);

		t.ok(httpHost._routes.ws.fixed.size === 1);
		t.ok(httpHost._routes.ws.fixed.get('/') === wsHost);
		t.ok(wsHost.connections instanceof Set);
		t.ok(wsHost._channels instanceof Map);
		t.match(wsHost._options, WsHost.optionsContainer());
		t.ok(wsHost._advanced === false);
		t.ok(wsHost._parent === httpHost);
		t.ok(wsHost.dynamic === false);
		t.ok(wsHost.listener === noopListener);
		t.ok(wsHost.location === '/');

		t.end();
	});

	test.test('Dynamic host', (t) => {

		const httpHost = new HttpHost();
		const noopListener = () => null;

		const wsHost = WsHost.create(httpHost, '/*', null, noopListener);

		t.ok(httpHost._routes.ws.dynamic.size === 1);
		t.ok(httpHost._routes.ws.dynamic.get('/*') === wsHost);
		t.ok(wsHost.connections instanceof Set);
		t.ok(wsHost._channels instanceof Map);
		t.match(wsHost._options, WsHost.optionsContainer());
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

tap.test('WsHost.prototype.broadcast()', (test) => {

	const host = new WsHost();

	sinon.spy(WsFormatter, 'broadcast');

	test.ok(host.broadcast('data') === host);
	test.ok(WsFormatter.broadcast.calledOnce);

	WsFormatter.broadcast.restore();

	test.end();
});

tap.test('WsHost.prototype.channel()', (test) => {

	const host = new WsHost();

	let newChannel = null;

	test.test('Empty input', (t) => {

		t.ok(host.channel() === null);

		t.end();
	});

	test.test('Create a new channel', (t) => {

		sinon.spy(WsChannel, 'create');

		newChannel = host.channel('name');

		t.ok(host._channels.size === 1);
		t.ok(host._channels.get('name') === newChannel);
		t.ok(newChannel instanceof WsChannel);
		t.ok(WsChannel.create.calledOnce);

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

		const firstConnection = new WsConnection(host, fakeLocation, fakeRequest);
		const secondConnection = new WsConnection(host, fakeLocation, fakeRequest);

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