'use strict';

const http = require('http');
const tap = require('tap');
const { URL } = require('url');

const HTTPHost = require('simples/lib/http/host');
const MapContainer = require('simples/lib/utils/map-container');
const Mirror = require('simples/lib/mirror');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('Server.prototype.constructor()', (test) => {

	const server = new Server();
	const hosts = Server.getHTTPHosts(server);
	const meta = ServerUtils.getServerMeta(server);

	test.ok(server instanceof HTTPHost);
	test.match(server._options, {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		static: {},
		timeout: {}
	});
	test.match(hosts, MapContainer.dynamic());
	test.match(meta, {
		backlog: null,
		busy: true,
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

tap.test('Server.prototype.host()', (test) => {

	const server = new Server();

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

	const server = new Server();

	test.ok(server.mirror() instanceof Mirror);
	test.end();
});

tap.test('Server.prototype.start()', (test) => {

	const server = new Server();

	const result = server.start((s) => {
		test.equal(s, server);

		test.end();
	});

	test.equal(result, server);
});

tap.test('Server.prototype.stop()', (test) => {

	const server = new Server();

	const result = server.stop((s) => {
		test.equal(s, server);

		test.end();
	});

	test.equal(result, server);
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

		const server = new Server();

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

		const server = new Server();

		Server.setHTTPHosts(server);

		const localHost = new HTTPHost('localhost');

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
	test.equal(Server.getHTTPHostName('[::1]'), '[::1]');
	test.equal(Server.getHTTPHostName('[::1]:8080'), '[::1]');

	test.end();
});

tap.test('Server.getHTTPHosts() / Server.setHTTPHosts()', (test) => {

	const server = new Server();

	Server.setHTTPHosts(server);

	const hosts = Server.getHTTPHosts(server);

	test.match(hosts, MapContainer.dynamic());

	test.end();
});

tap.test('Server.getRequestLocation()', (test) => {

	test.test('No host provided, not secured socket', (t) => {

		const request = {
			headers: {},
			socket: {
				encrypted: false,
				localAddress: '127.0.0.1'
			},
			url: '/'
		};

		const location = Server.getRequestLocation(request, 'http');

		t.match(location, new URL('http://127.0.0.1/'));

		t.end();
	});

	test.test('Host provided, secured socket', (t) => {

		const request = {
			headers: {
				host: 'localhost'
			},
			socket: {
				encrypted: true,
				localAddress: '127.0.0.1'
			},
			url: '/'
		};

		const location = Server.getRequestLocation(request, 'http');

		t.match(location, new URL('https://localhost/'));

		t.end();
	});

	test.end();
});

tap.test('Server.getWSHost()', (test) => {

	const request = {
		headers: {}
	};
	const server = new Server();
	const fakeWSHost = {};

	server._routes.ws.fixed.set('/', fakeWSHost);

	const wsHost = Server.getWSHost(server, { pathname: '/' }, request);

	test.equal(wsHost, fakeWSHost);

	test.end();
});

tap.test('Server.requestListener()', (test) => {

	const server = new Server();
	const requestListener = Server.requestListener(server);

	server.get('/', (connection) => {
		connection.end();
	});

	test.ok(typeof requestListener === 'function');
	test.equal(requestListener.length, 2);

	const fakeRequest = {
		headers: {},
		method: 'GET',
		socket: {
			destroy: () => null,
			localAddress: '127.0.0.1',
			on: () => null,
			setTimeout: () => null
		},
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

	const server = new Server();
	const upgradeListener = Server.upgradeListener(server);

	server.on('error', (error) => {
		test.ok(error instanceof Error)
	});

	server.ws('/', (connection) => {
		connection.end();
	});

	test.equal(typeof upgradeListener, 'function');
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
			headers: {
				'host': 'localhost',
				'sec-websocket-key': 'true',
				'sec-websocket-version': '13',
				'upgrade': 'websocket'
			},
			socket: fakeSocket,
			url: '/'
		};

		upgradeListener(fakeRequest, fakeSocket);
	});

	test.test('WS host not found', (t) => {

		const fakeSocket = {
			destroy: () => t.end()
		};
		const fakeRequest = {
			headers: {
				host: 'localhost'
			},
			socket: fakeSocket,
			url: '/no-ws-host'
		};

		upgradeListener(fakeRequest, fakeSocket);
	});

	test.end();
});