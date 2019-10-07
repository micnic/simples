'use strict';

const http = require('http');
const https = require('https');
const mockFS = require('mock-fs');
const tap = require('tap');
const { URL } = require('url');

const Server = require('simples/lib/server');
const HTTPHost = require('simples/lib/http/host');
const MapContainer = require('simples/lib/utils/map-container');
const ServerUtils = require('simples/lib/utils/server-utils');
const TestUtils = require('simples/test/test-utils');

mockFS({
	'path/to/cert.pem': 'cert'
});

TestUtils.mockHTTPServer();

tap.test('ServerUtils.getTLSOptions()', (test) => {

	test.test('Resolved promise', (t) => {
		ServerUtils.getTLSOptions({
			cert: 'path/to/cert.pem',
			prop: 'prop'
		}).then((config) => {

			t.ok(config.cert.toString() === 'cert');
			t.ok(config.prop === 'prop');
			t.ok(Object.keys(config).length === 2);

			t.end();
		}).catch(() => {
			t.fail('The promise should not be rejected');
		});
	});

	test.test('Rejected promise', (t) => {

		ServerUtils.getTLSOptions({
			cert: 'path/to/non-existent-cert.pem'
		}).then(() => {
			t.fail('The promise should not be resolved');
		}).catch((error) => {
			t.ok(error instanceof Error);

			t.end();
		});
	});

	test.end();
});

tap.test('ServerUtils.prepareServerArgs()', (test) => {

	test.test('Port, options and callback provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(12345, {
			port: 80
		}, () => {}), {
			callback: Function,
			options: {
				port: 12345
			}
		});

		t.end();
	});

	test.test('Port and options provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(12345, {
			port: 80
		}), {
			callback: null,
			options: {
				port: 12345
			}
		});

		t.end();
	});

	test.test('Port and callback provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(12345, () => {}), {
			callback: Function,
			options: {
				port: 12345
			}
		});

		t.end();
	});

	test.test('Only port provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(12345), {
			callback: null,
			options: {
				port: 12345
			}
		});

		t.end();
	});

	test.test('Options and callback provided', (t) => {

		t.match(ServerUtils.prepareServerArgs({}, () => {}), {
			callback: Function,
			options: {
				port: 80
			}
		});

		t.end();
	});

	test.test('Only options with port provided', (t) => {

		t.match(ServerUtils.prepareServerArgs({
			port: 12345
		}), {
			callback: null,
			options: {
				port: 12345
			}
		});

		t.end();
	});

	test.test('Only HTTPS options provided', (t) => {

		t.match(ServerUtils.prepareServerArgs({
			https: {}
		}), {
			callback: null,
			options: {
				port: 443
			}
		});

		t.end();
	});

	test.test('Only callback provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(() => {}), {
			callback: Function,
			options: {
				port: 80
			}
		});

		t.end();
	});

	test.test('No arguments provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(), {
			callback: null,
			options: {
				port: 80
			}
		});

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.runFunction()', (test) => {

	test.test('Empty input', (t) => {

		ServerUtils.runFunction();

		t.end();
	});

	test.test('No context', (t) => {
		ServerUtils.runFunction(() => {
			t.end();
		});
	});

	test.test('With context', (t) => {

		const context = {
			fn(c) {
				t.ok(this === context);
				t.ok(c === context);
				t.end();
			}
		};

		ServerUtils.runFunction(context.fn, context);
	});

	test.end();
});

tap.test('ServerUtils.listenPort()', (test) => {

	const server = new Server();

	const meta = server._meta;

	meta.instance = http.Server();

	ServerUtils.listenPort(server, 80, (s) => {
		test.ok(s === server);
		test.ok(!meta.busy);

		server.on('start', (arg) => {
			test.ok(arg === server);
		}).on('release', () => {
			test.end();
		});
	});

	test.ok(meta.busy);
	test.ok(meta.port === 80);
	test.ok(meta.started);
});

tap.test('ServerUtils.stopServer()', (test) => {

	test.test('Busy started server', (t) => {

		const server = new Server();
		const meta = server._meta;

		ServerUtils.stopServer(server, (s) => {

			t.ok(s === server);
			t.ok(!meta.busy);
			t.ok(!meta.started);

			server.on('stop', (arg) => {
				t.ok(arg === server);
			}).on('release', () => {
				t.end();
			});
		});
	});

	test.test('Released started server', (t) => {

		const server = new Server();
		const meta = server._meta;

		server.once('release', () => {

			ServerUtils.stopServer(server, (s) => {

				t.ok(s === server);
				t.ok(!meta.busy);
				t.ok(!meta.started);
			});

			t.ok(meta.busy);
			t.ok(!meta.started);

			ServerUtils.stopServer(server, (s) => {

				t.ok(s === server);
				t.ok(!meta.busy);
				t.ok(!meta.started);

				t.end();
			});
		});
	});

	test.end();
});

tap.test('ServerUtils.startServer()', (test) => {

	test.test('No port provided and not started server', (t) => {

		const server = new Server();

		server.once('release', () => {
			ServerUtils.startServer(server, 12345);

			server.once('release', () => {
				t.ok(server._meta.busy);
				t.ok(server._meta.started);
				t.end();
			});
		});
	});

	test.end();
});

tap.test('ServerUtils.setupServer()', (test) => {

	const server = new Server();

	const meta = server._meta;
	const someError = Error('Some error');

	meta.instance = http.Server();
	meta.requestListener = () => null;
	meta.upgradeListener = () => null;

	server.on('error', (error) => {
		test.ok(error === someError);
		test.ok(!meta.busy);
		test.ok(!meta.started);
	});

	ServerUtils.setupServer(server, (s) => {

		meta.instance.emit('error', someError);

		test.ok(s === server);
		test.ok(meta.instance.listenerCount('request') === 1);
		test.ok(meta.instance.listeners('request')[0] === meta.requestListener);
		test.ok(meta.instance.listenerCount('upgrade') === 1);
		test.ok(meta.instance.listeners('upgrade')[0] === meta.upgradeListener);
		test.end();
	});
});

tap.test('ServerUtils.initServer()', (test) => {

	test.test('HTTP server', (t) => {

		const server = new Server();

		const meta = server._meta;

		meta.requestListener = () => null;
		meta.upgradeListener = () => null;

		ServerUtils.initServer(server, (s) => {
			t.ok(s === server);
			t.ok(meta.instance instanceof http.Server);
			t.end();
		});

		t.ok(meta.busy);
	});

	test.test('HTTPS server', (t) => {

		const server = new Server();

		const meta = server._meta;

		meta.https = {};
		meta.requestListener = () => null;
		meta.upgradeListener = () => null;

		ServerUtils.initServer(server, (s) => {
			t.ok(s === server);
			t.ok(meta.instance instanceof https.Server);
			t.end();
		});

		t.ok(meta.busy);
	});

	test.test('HTTPS server with error', (t) => {

		const server = new Server();

		const meta = server._meta;

		meta.https = {
			cert: 'path/to/non-existent-cert.pem'
		};
		meta.requestListener = () => null;
		meta.upgradeListener = () => null;

		server.on('error', (error) => {
			t.ok(error instanceof Error);
			t.end();
		});

		ServerUtils.initServer(server, (s) => {
			t.ok(s === server);
		});

		t.ok(meta.busy);
	});

	test.end();
});

tap.test('ServerUtils.getHost()', (test) => {

	const hostsContainer = MapContainer.dynamic();

	const fixedHost = {};
	const dynamicHost = {
		_pattern: /dynamic-host/
	};

	hostsContainer.dynamic.set('dynamic-host', dynamicHost);
	hostsContainer.fixed.set('fixed-host', fixedHost);

	test.test('Main host', (t) => {

		const host = ServerUtils.getHost(hostsContainer, 'main-host', null);

		t.equal(host, null);

		t.end();
	});

	test.test('Fixed host', (t) => {

		const host = ServerUtils.getHost(hostsContainer, 'fixed-host', null);

		t.equal(host, fixedHost);

		t.end();
	});

	test.test('Dynamic host', (t) => {

		const host = ServerUtils.getHost(hostsContainer, 'dynamic-host', null);

		t.equal(host, dynamicHost);

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.getHTTPHost()', (test) => {

	test.test('Without host header', (t) => {

		const request = {
			headers: {}
		};

		const server = new Server();

		const host = ServerUtils.getHTTPHost(server, request);

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

		const localHost = new HTTPHost('localhost');

		server._hosts.fixed.set('localhost', localHost);

		const host = ServerUtils.getHTTPHost(server, request);

		t.equal(host, localHost);

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.getHTTPHostName()', (test) => {

	test.equal(ServerUtils.getHTTPHostName('localhost'), 'localhost');
	test.equal(ServerUtils.getHTTPHostName('localhost:8080'), 'localhost');
	test.equal(ServerUtils.getHTTPHostName('[::1]'), '[::1]');
	test.equal(ServerUtils.getHTTPHostName('[::1]:8080'), '[::1]');

	test.end();
});

tap.test('ServerUtils.getRequestLocation()', (test) => {

	test.test('No host provided, not secured socket', (t) => {

		const request = {
			headers: {},
			socket: {
				encrypted: false,
				localAddress: '127.0.0.1'
			},
			url: '/'
		};

		const location = ServerUtils.getRequestLocation(request, 'http');

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

		const location = ServerUtils.getRequestLocation(request, 'http');

		t.match(location, new URL('https://localhost/'));

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.isHTTPHostNameDynamic()', (test) => {

	test.notOk(ServerUtils.isHTTPHostNameDynamic('host.com'));
	test.ok(ServerUtils.isHTTPHostNameDynamic('*.host.com'));

	test.end();
});

tap.test('ServerUtils.getWSHost()', (test) => {

	const request = {
		headers: {}
	};
	const server = new Server();
	const fakeWSHost = {};

	server._routes.ws.fixed.set('/', fakeWSHost);

	const wsHost = ServerUtils.getWSHost(server, '/', request);

	test.equal(wsHost, fakeWSHost);

	test.end();
});

tap.test('ServerUtils.requestListener()', (test) => {

	const server = new Server();
	const requestListener = ServerUtils.requestListener(server);

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

tap.test('ServerUtils.upgradeListener()', (test) => {

	const server = new Server();
	const upgradeListener = ServerUtils.upgradeListener(server);

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
			end: () => t.end()
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

tap.tearDown(() => {
	mockFS.restore();
});