'use strict';

const fs = require('fs');
const https = require('https');
const tap = require('tap');

const ErrorEmitter = require('simples/lib/utils/error-emitter');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('ServerUtils.getTlsOptions()', (test) => {

	test.test('Resolved promise', (t) => {

		TestUtils.mockFSReadFile(null, 'content');

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

	test.test('Rejected promise', (t) => {

		const someError = Error('Some error');

		TestUtils.mockFSReadFile(someError, 'content');

		ServerUtils.getTlsOptions({
			cert: 'cert'
		}).then(() => {
			t.fail('The promise should not be resolved');
		}).catch((error) => {
			t.ok(error === someError);

			t.end();
		});
	});

	test.end();
});

tap.test('ServerUtils.getArgs()', (test) => {

	const noop = () => null;

	const result = ServerUtils.getArgs(['boolean', 'function'], noop);

	test.match(result, [null, noop]);

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

	const server = Server.create();

	server._hostname = 'hostname';
	server._backlog = 100;

	server._instance = {
		listen(port, hostname, backlog, callback) {
			test.ok(port === 80);
			test.ok(hostname === 'hostname');
			test.ok(backlog === 100);
			callback();
		}
	};

	server.on('start', (serv) => {
		test.ok(serv === server);
	}).on('release', () => {

		test.end();
	});

	ServerUtils.listenPort(server, 80, () => {});
});

tap.test('ServerUtils.stopServer()', (test) => {

	test.test('Inactive server', (t) => {

		const server = Server.create();

		ServerUtils.stopServer(server, (serv) => {

			t.ok(serv === server);

			t.end();
		});
	});

	test.test('Started server', (t) => {

		const server = Server.create();


		server.on('stop', (serv) => {
			t.ok(serv === server);
		}).on('release', () => {

			t.end();
		});

		ServerUtils.stopServer(server, (serv) => {
			t.ok(serv === server);
		});
	});

	test.test('Busy server', (t) => {

		const server = Server.create();

		ServerUtils.stopServer(server, (serv) => {

			t.ok(serv === server);

			t.end();
		});

		server.emit('release');
	});

	test.end();
});

tap.test('ServerUtils.startServer()', (test) => {

	test.test('No port provided and uninitialized server', (t) => {

		const server = Server.create();

		ServerUtils.startServer(server);

		t.end();
	});

	test.test('Invalid port number provided and uninitialized server', (t) => {

		const server = Server.create();

		ServerUtils.startServer(server, -1);

		t.end();
	});

	test.test('Port provided and busy server', (t) => {

		const server = Server.create();

		ServerUtils.startServer(server, 80);

		server.emit('release');

		t.end();
	});

	test.test('Same server port provided and started server', (t) => {

		const server = Server.create();

		ServerUtils.startServer(server, 80);

		t.end();
	});

	test.test('Restart server', (t) => {

		const server = Server.create();

		ServerUtils.startServer(server, 12345);

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.setupServer()', (test) => {

	const server = Server.create();
	const noop = () => null;
	const someError = Error('Some error');

	server.on('error', (error) => {
		test.ok(error === someError);
		test.ok(server._busy === false);
		test.ok(server._started === false);
	});

	ServerUtils.setupServer(server, noop);

	test.end();
});

tap.test('ServerUtils.initServer()', (test) => {

	test.test('HTTP server', (t) => {

		const fakeServer = Server.create();
		const noop = () => null;

		ServerUtils.initServer(fakeServer, {
			backlog: 'backlog',
			hostname: 'hostname',
			port: 80
		}, noop);

		t.end();
	});

	test.test('HTTPS server', (t) => {

		const fakeServer = Server.create();
		const httpsOptions = {};

		const callback = () => {
			t.ok(fakeServer._backlog === 'backlog');
			t.ok(fakeServer._busy === false);
			t.ok(fakeServer._hostname === 'hostname');
			t.ok(fakeServer._instance instanceof https.Server);
			t.ok(fakeServer._port === 443);
			t.ok(fakeServer._started === false);
		};

		ServerUtils.initServer(fakeServer, {
			backlog: 'backlog',
			hostname: 'hostname',
			https: httpsOptions,
			port: 443
		}, callback);

		t.end();
	});

	test.test('HTTPS server with error', (t) => {

		const fakeServer = Server.create();
		const httpsOptions = {};
		const someError = Error('Some error');

		const callback = (server) => {
			t.ok(fakeServer._backlog === 'backlog');
			t.ok(fakeServer._busy === true);
			t.ok(fakeServer._hostname === 'hostname');
			t.ok(fakeServer._port === 443);
			t.ok(fakeServer._started === false);

			server.on('error', (error) => {
				t.ok(error === someError);

				t.ok(ErrorEmitter.emit.calledOnce);


			});
		};

		ServerUtils.initServer(fakeServer, {
			backlog: 'backlog',
			hostname: 'hostname',
			https: httpsOptions,
			port: 443
		}, callback);

		t.end();
	});

	test.end();
});