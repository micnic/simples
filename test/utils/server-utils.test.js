'use strict';

const http = require('http');
const https = require('https');
const tap = require('tap');

const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('ServerUtils.getTlsOptions()', (test) => {

	test.test('Resolved promise', (t) => {

		TestUtils.mockFSReadFile(null, 'content', () => {
			ServerUtils.getTlsOptions({
				cert: 'cert',
				prop: 'prop'
			}).then((config) => {

				t.ok(config.cert === 'content');
				t.ok(config.prop === 'prop');
				t.ok(Object.keys(config).length === 2);

				t.end();
			}).catch(() => {
				t.fail('The promise should not be rejected');
			});
		});
	});

	test.test('Rejected promise', (t) => {

		const someError = Error('Some error');

		TestUtils.mockFSReadFile(someError, 'content', () => {
			ServerUtils.getTlsOptions({
				cert: 'cert'
			}).then(() => {
				t.fail('The promise should not be resolved');
			}).catch((error) => {
				t.ok(error === someError);

				t.end();
			});
		});
	});

	test.end();
});

tap.test('ServerUtils.prepareServerArgs()', (test) => {

	test.test('Port argument is a number', (t) => {

		t.match(ServerUtils.prepareServerArgs(12345), {
			callback: null,
			options: {
				port: 12345
			}
		});

		t.end();
	});

	test.test('Port as number is defined inside options object', (t) => {

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

	test.test('HTTPS options provided', (t) => {

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

	ServerUtils.setServerMeta(server);

	const meta = ServerUtils.getServerMeta(server);

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
		const meta = ServerUtils.getServerMeta(server);

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
		const meta = ServerUtils.getServerMeta(server);

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

	test.test('No port provided and uninitialized server', (t) => {

		const server = new Server();

		ServerUtils.setServerMeta(server);

		const meta = ServerUtils.getServerMeta(server);

		meta.instance = http.Server();

		ServerUtils.startServer(server, (s) => {

			t.ok(s === server);

			t.end();
		});

		t.ok(meta.busy);
		t.ok(meta.started);
	});

	test.test('Port provided and busy started server', (t) => {

		const server = new Server();

		ServerUtils.setServerMeta(server);

		const meta = ServerUtils.getServerMeta(server);

		meta.instance = http.Server();
		meta.busy = true;
		meta.started = true;

		ServerUtils.startServer(server, 80, (s) => {

			t.ok(s === server);
		});

		meta.busy = false;
		server.emit('release');

		ServerUtils.startServer(server, 80, (s) => {

			t.ok(s === server);

			t.end();
		});
	});

	test.end();
});

tap.test('ServerUtils.setupServer()', (test) => {

	const server = new Server();

	ServerUtils.setServerMeta(server);

	const meta = ServerUtils.getServerMeta(server);
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

		ServerUtils.setServerMeta(server);

		const meta = ServerUtils.getServerMeta(server);

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

		ServerUtils.setServerMeta(server);

		const meta = ServerUtils.getServerMeta(server);

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

		ServerUtils.setServerMeta(server);

		const meta = ServerUtils.getServerMeta(server);

		meta.https = {
			cert: 'cert'
		};
		meta.requestListener = () => null;
		meta.upgradeListener = () => null;

		server.on('error', () => {
			t.end();
		});

		ServerUtils.initServer(server, (s) => {
			t.ok(s === server);
			t.ok(meta.instance === null);
		});

		t.ok(meta.busy);
	});

	test.end();
});