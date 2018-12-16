'use strict';

const http = require('http');
const tap = require('tap');
const url = require('url');

const HTTPHost = require('simples/lib/http/host');
const MapContainer = require('simples/lib/utils/map-container');
const Mirror = require('simples/lib/mirror');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('Server.prototype.host()', (test) => {

	const server = Server.create();

	test.test('No host name provided', (t) => {
		t.equal(server.host(), null);
		t.end();
	});

	test.test('Create a new fixed host', (t) => {

		const host = server.host('hostname');

		t.ok(host instanceof HTTPHost);
		t.equal(Server.getHTTPHosts(server).fixed.get('hostname'), host);
		t.end();
	});

	test.test('Create a new dynamic host', (t) => {

		const host = server.host('*.hostname');

		t.ok(host instanceof HTTPHost);
		t.equal(Server.getHTTPHosts(server).dynamic.get('*.hostname'), host);
		t.end();
	});

	test.end();
});

tap.test('Server.prototype.mirror()', (test) => {

	const server = Server.create();

	test.ok(server.mirror() instanceof Mirror);
	test.end();
});

tap.test('Server.prototype.start()', (test) => {

	const server = Server.create();

	const result = server.start((s) => {
		test.equal(s, server);
	});

	test.equal(result, server);

	test.end();
});

tap.test('Server.prototype.stop()', (test) => {

	const server = Server.create();

	const result = server.stop((s) => {
		test.equal(s, server);
	});

	test.equal(result, server);

	test.end();
});

tap.test('Server.create()', (test) => {

	const server = Server.create();
	const hosts = Server.getHTTPHosts(server);
	const meta = ServerUtils.getServerMeta(server);

	test.ok(server instanceof Server);
	test.match(server._options, {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		static: {},
		timeout: 5000
	});
	test.match(hosts, MapContainer.dynamic());
	test.match(meta, {
		backlog: null,
		busy: false,
		hostname: '',
		https: null,
		instance: http.Server,
		port: 80,
		requestListener: Function,
		started: true,
		upgradeListener: Function
	});
	test.end();
});

tap.test('Server.getHost()', (test) => {

	const hostsContainer = MapContainer.dynamic();

	const fixedHost = {};
	const dynamicHost = {
		_pattern: /dynamic-host/
	};

	hostsContainer.dynamic.set('dynamic-host', dynamicHost);
	hostsContainer.fixed.set('fixed-host', fixedHost);

	test.test('Main host', (t) => {

		const host = Server.getHost(hostsContainer, 'main-host', null);

		t.equal(host, null);

		t.end();
	});

	test.test('Fixed host', (t) => {

		const host = Server.getHost(hostsContainer, 'fixed-host', null);

		t.equal(host, fixedHost);

		t.end();
	});

	test.test('Dynamic host', (t) => {

		const host = Server.getHost(hostsContainer, 'dynamic-host', null);

		t.equal(host, dynamicHost);

		t.end();
	});

	test.end();
});

tap.test('Server.getHTTPHost()', (test) => {

	test.test('Without host header', (t) => {

		const request = {
			headers: {}
		};

		const server = Server.create();

		Server.setHTTPHosts(server);

		const host = Server.getHTTPHost(server, request);

		t.equal(host, server);

		t.end();
	});

	test.test('With host header', (t) => {

		const request = {
			headers: {
				host: 'localhost'
			}
		};

		const server = Server.create();

		Server.setHTTPHosts(server);

		const localHost = HTTPHost.create('localhost');

		Server.getHTTPHosts(server).fixed.set('localhost', localHost);

		const host = Server.getHTTPHost(server, request);

		t.equal(host, localHost);

		t.end();
	});

	test.end();
});

tap.test('Server.getHTTPHostName()', (test) => {

	test.equal(Server.getHTTPHostName('localhost'), 'localhost');
	test.equal(Server.getHTTPHostName('localhost:8080'), 'localhost');

	test.end();
});

tap.test('Server.getHTTPHosts() / Server.setHTTPHosts()', (test) => {

	const server = Server.create();

	Server.setHTTPHosts(server);

	const hosts = Server.getHTTPHosts(server);

	test.match(hosts, MapContainer.dynamic());

	test.end();
});

tap.test('Server.getRequestLocation()', (test) => {

	test.test('No host provided, not secured socket', (t) => {

		const request = {
			connection: {
				encrypted: false,
				localAddress: '127.0.0.1'
			},
			headers: {},
			url: '/'
		};

		const location = Server.getRequestLocation(request, 'http');

		t.match(location, url.parse('http://127.0.0.1/'));

		t.end();
	});

	test.test('Host provided, secured socket', (t) => {

		const request = {
			connection: {
				encrypted: true,
				localAddress: '127.0.0.1'
			},
			headers: {
				host: 'localhost'
			},
			url: '/'
		};

		const location = Server.getRequestLocation(request, 'http');

		t.match(location, url.parse('https://localhost/'));

		t.end();
	});

	test.end();
});

tap.test('Server.getWSHost()', (test) => {

	const request = {
		headers: {}
	};
	const server = Server.create();
	const fakeWSHost = {};

	server._routes.ws.fixed.set('/', fakeWSHost);

	const wsHost = Server.getWSHost(server, { pathname: '/' }, request);

	test.equal(wsHost, fakeWSHost);

	test.end();
});

tap.test('Server.requestListener()', (test) => {

	const server = Server.create();
	const requestListener = Server.requestListener(server);

	server.get('/', (connection) => {
		connection.end();
	});

	test.ok(typeof requestListener === 'function');
	test.equal(requestListener.length, 2);

	const fakeRequest = {
		connection: {
			destroy: () => null,
			localAddress: '127.0.0.1',
			setTimeout: () => null
		},
		headers: {},
		method: 'GET',
		url: '/'
	};
	const fakeResponse = {
		emit: () => null,
		end: () => test.end(),
		getHeader: () => null,
		on: () => null,
		once: () => null,
		setHeader: () => null
	};

	requestListener(fakeRequest, fakeResponse);
});

tap.test('Server.upgradeListener()', (test) => {

	const server = Server.create();
	const upgradeListener = Server.upgradeListener(server);

	server.ws('/', (connection) => {
		connection.end();
	});

	test.ok(typeof upgradeListener === 'function');
	test.equal(upgradeListener.length, 2);

	test.test('WS host found', (t) => {

		const fakeSocket = {
			destroy: () => null,
			emit: () => null,
			end: () => t.end(),
			localAddress: '127.0.0.1',
			on: () => null,
			once: () => null,
			pipe: () => null,
			setTimeout: () => null,
			write: () => null
		};
		const fakeRequest = {
			connection: fakeSocket,
			headers: {
				'host': 'localhost',
				'sec-websocket-key': 'true',
				'sec-websocket-version': '13',
				'upgrade': 'websocket'
			},
			url: '/'
		};

		upgradeListener(fakeRequest, fakeSocket);
	});

	test.test('WS host not found', (t) => {

		const fakeSocket = {
			destroy: () => t.end()
		};
		const fakeRequest = {
			connection: fakeSocket,
			headers: {
				host: 'localhost'
			},
			url: ''
		};

		upgradeListener(fakeRequest, fakeSocket);
	});

	test.end();
});