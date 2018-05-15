'use strict';

const sinon = require('sinon');
const tap = require('tap');

const { EventEmitter } = require('events');
const http = require('http');
const https = require('https');

const ErrorEmitter = require('simples/lib/utils/error-emitter');
const fs = require('fs');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');

const sandbox = sinon.createSandbox();

tap.test('ServerUtils.getTlsOptions()', (test) => {

	test.test('Resolved promise', (t) => {

		sandbox.stub(fs, 'readFile').callsArgWith(1, null, 'content');

		ServerUtils.getTlsOptions({
			cert: 'cert',
			prop: 'prop'
		}).then((config) => {

			t.ok(config.cert === 'content');
			t.ok(config.prop === 'prop');
			t.ok(Object.keys(config).length === 2);

			sandbox.restore();

			t.end();
		}).catch(() => {
			t.fail('The promise should not be rejected');
		});
	});

	test.test('Rejected promise', (t) => {

		const someError = Error('Some error');

		sandbox.stub(fs, 'readFile').callsArgWith(1, someError);

		ServerUtils.getTlsOptions({
			cert: 'cert'
		}).then(() => {
			t.fail('The promise should not be resolved');
		}).catch((error) => {
			t.ok(error === someError);

			sandbox.restore();

			t.end();
		});
	});

	test.end();
});

tap.test('ServerUtils.normalizeArgs()', (test) => {

	const noop = () => null;

	const result = ServerUtils.normalizeArgs(['boolean', 'function'], {
		0: noop,
		length: 1
	});

	test.match(result, [null, noop]);

	test.end();
});

tap.test('ServerUtils.prepareServerArgs()', (test) => {

	test.test('Port argument is a number', (t) => {

		t.match(ServerUtils.prepareServerArgs(12345), [{
			port: 12345
		}, null]);

		t.end();
	});

	test.test('Port as number is defined inside options object', (t) => {

		t.match(ServerUtils.prepareServerArgs({
			port: 12345
		}), [{
			port: 12345
		}, null]);

		t.end();
	});

	test.test('HTTPS options provided', (t) => {

		t.match(ServerUtils.prepareServerArgs({
			https: {}
		}), [{
			port: 443
		}, null]);

		t.end();
	});

	test.test('No arguments provided', (t) => {

		t.match(ServerUtils.prepareServerArgs(), [{
			port: 80
		}, null]);

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

		const fake = sinon.fake();

		ServerUtils.runFunction(fake);

		t.ok(fake.calledOnce);

		t.end();
	});

	test.test('With context', (t) => {

		const fake = sinon.fake();
		const context = {};

		ServerUtils.runFunction(fake, context);

		t.ok(fake.calledOnce);
		t.ok(fake.calledOn(context));
		t.ok(fake.calledWith(context));

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.listenPort()', (test) => {

	const fakeServer = new Server();

	sandbox.spy(ServerUtils, 'runFunction');

	fakeServer._hostname = 'hostname';
	fakeServer._backlog = 100;

	fakeServer._instance = {
		listen(port, hostname, backlog, callback) {
			test.ok(port === 80);
			test.ok(hostname === 'hostname');
			test.ok(backlog === 100);
			callback();
		}
	};

	fakeServer.on('start', (server) => {
		test.ok(server === fakeServer);
	}).on('release', () => {
		test.ok(ServerUtils.runFunction.calledOnce);
		test.ok(ServerUtils.runFunction.calledWith(sinon.match.func, fakeServer));

		sandbox.restore();

		test.end();
	});

	ServerUtils.listenPort(fakeServer, 80, () => {

		test.ok(fakeServer._busy === false);
	});
});

tap.test('ServerUtils.stopServer()', (test) => {

	test.test('Inactive server', (t) => {

		const fakeServer = new Server();

		sandbox.spy(ServerUtils, 'runFunction');

		fakeServer._busy = false;
		fakeServer._started = false;

		ServerUtils.stopServer(fakeServer, (server) => {

			t.ok(server === fakeServer);
			t.ok(server._busy === false);
			t.ok(server._started === false);
			t.ok(ServerUtils.runFunction.calledOnce);
			t.ok(ServerUtils.runFunction.calledWith(sinon.match.func, fakeServer));

			sandbox.restore();

			t.end();
		});
	});

	test.test('Started server', (t) => {

		const fakeServer = new Server();

		sandbox.spy(ServerUtils, 'runFunction');

		fakeServer._instance = {
			close(callback) {
				callback();
			}
		};

		fakeServer._busy = false;
		fakeServer._started = true;

		fakeServer.on('stop', (server) => {
			t.ok(server === fakeServer);
		}).on('release', () => {
			t.ok(ServerUtils.runFunction.calledOnce);
			t.ok(ServerUtils.runFunction.calledWith(sinon.match.func, fakeServer));

			sandbox.restore();

			t.end();
		});

		ServerUtils.stopServer(fakeServer, (server) => {

			t.ok(server === fakeServer);
			t.ok(server._busy === false);
			t.ok(server._started === false);
		});
	});

	test.test('Busy server', (t) => {

		const fakeServer = new Server();

		sandbox.spy(ServerUtils, 'runFunction');

		fakeServer._busy = true;
		fakeServer._started = false;

		ServerUtils.stopServer(fakeServer, (server) => {

			t.ok(server === fakeServer);
			t.ok(server._busy === false);
			t.ok(server._started === false);
			t.ok(ServerUtils.runFunction.calledOnce);
			t.ok(ServerUtils.runFunction.calledWith(sinon.match.func, fakeServer));

			sandbox.restore();

			t.end();
		});

		t.ok(ServerUtils.runFunction.notCalled);

		fakeServer._busy = false;
		fakeServer.emit('release');
	});

	test.end();
});

tap.test('ServerUtils.startServer()', (test) => {

	test.test('No port provided and uninitialized server', (t) => {

		const fakeServer = new Server();

		fakeServer._busy = false;
		fakeServer._port = 12345;
		fakeServer._started = false;

		sandbox.stub(ServerUtils, 'listenPort');

		ServerUtils.startServer(fakeServer);

		t.ok(ServerUtils.listenPort.calledOnceWith(fakeServer, 12345, null));

		sandbox.restore();

		t.end();
	});

	test.test('Invalid port number provided and uninitialized server', (t) => {

		const fakeServer = new Server();

		fakeServer._busy = false;
		fakeServer._port = 12345;
		fakeServer._started = false;

		sandbox.stub(ServerUtils, 'listenPort');

		ServerUtils.startServer(fakeServer, -1);

		t.ok(ServerUtils.listenPort.calledOnceWith(fakeServer, 12345, null));

		sandbox.restore();

		t.end();
	});

	test.test('Port provided and busy server', (t) => {

		const fakeServer = new Server();

		fakeServer._busy = true;
		fakeServer._started = false;

		sandbox.stub(ServerUtils, 'listenPort');
		sandbox.spy(ServerUtils, 'startServer');

		ServerUtils.startServer(fakeServer, 80);

		fakeServer._busy = false;
		fakeServer.emit('release');

		t.ok(ServerUtils.listenPort.calledOnceWith(fakeServer, 80, null));
		t.ok(ServerUtils.startServer.calledTwice);
		t.ok(ServerUtils.startServer.alwaysCalledWith(fakeServer, 80));

		sandbox.restore();

		t.end();
	});

	test.test('Same server port provided and started server', (t) => {

		const fakeServer = new Server();

		fakeServer._busy = false;
		fakeServer._started = true;
		fakeServer._port = 80;

		sandbox.spy(ServerUtils, 'runFunction');

		ServerUtils.startServer(fakeServer, 80);

		t.ok(ServerUtils.runFunction.calledOnceWith(null, fakeServer));

		sandbox.restore();

		t.end();
	});

	test.test('Restart server', (t) => {

		const fakeServer = new Server();

		fakeServer._busy = false;
		fakeServer._started = true;
		fakeServer._port = 80;

		sandbox.stub(ServerUtils, 'stopServer').callsArg(1);
		sandbox.stub(ServerUtils, 'listenPort');

		ServerUtils.startServer(fakeServer, 12345);

		t.ok(ServerUtils.stopServer.calledOnceWith(fakeServer, sinon.match.func));
		t.ok(ServerUtils.listenPort.calledOnceWith(fakeServer, 12345, null));

		sandbox.restore();

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.setupServer()', (test) => {

	const fakeServer = new Server();
	const noop = () => null;
	const someError = Error('Some error');

	fakeServer._instance = new EventEmitter();

	fakeServer.on('error', (error) => {
		test.ok(error === someError);
		test.ok(fakeServer._busy === false);
		test.ok(fakeServer._started === false);
	});

	sandbox.spy(ErrorEmitter, 'emit');
	sandbox.stub(ServerUtils, 'startServer');

	ServerUtils.setupServer(fakeServer, noop);

	fakeServer._instance.emit('error', someError);

	test.ok(fakeServer._instance.listeners('error').length === 1);
	test.ok(fakeServer._instance.listeners('request').length === 1);
	test.ok(fakeServer._instance.listeners('request')[0] === fakeServer._requestListener);
	test.ok(fakeServer._instance.listeners('upgrade').length === 1);
	test.ok(fakeServer._instance.listeners('upgrade')[0] === fakeServer._upgradeListener);
	test.ok(ServerUtils.startServer.calledOnceWith(fakeServer, noop));
	test.ok(ErrorEmitter.emit.calledOnceWith(fakeServer, someError));

	sandbox.restore();

	test.end();
});

tap.test('ServerUtils.initServer()', (test) => {

	test.test('HTTP server', (t) => {

		const fakeServer = new Server();
		const noop = () => null;

		sandbox.stub(ServerUtils, 'setupServer');

		ServerUtils.initServer(fakeServer, {
			backlog: 'backlog',
			hostname: 'hostname',
			port: 80
		}, noop);

		t.ok(fakeServer._backlog === 'backlog');
		t.ok(fakeServer._busy === false);
		t.ok(fakeServer._hostname === 'hostname');
		t.ok(fakeServer._instance instanceof http.Server);
		t.ok(fakeServer._port === 80);
		t.ok(fakeServer._started === false);
		t.ok(ServerUtils.setupServer.calledOnceWith(fakeServer, noop));

		sandbox.restore();

		t.end();
	});

	test.test('HTTPS server', (t) => {

		const fakeServer = new Server();
		const httpsOptions = {};

		const callback = () => {
			t.ok(fakeServer._backlog === 'backlog');
			t.ok(fakeServer._busy === false);
			t.ok(fakeServer._hostname === 'hostname');
			t.ok(fakeServer._instance instanceof https.Server);
			t.ok(fakeServer._port === 443);
			t.ok(fakeServer._started === false);
			t.ok(ServerUtils.getTlsOptions.calledOnceWith(httpsOptions));
			t.ok(ServerUtils.setupServer.calledOnceWith(fakeServer, callback));

			sandbox.restore();

			t.end();
		};

		sandbox.stub(ServerUtils, 'setupServer').callsArg(1);
		sandbox.stub(ServerUtils, 'getTlsOptions').resolves({});

		ServerUtils.initServer(fakeServer, {
			backlog: 'backlog',
			hostname: 'hostname',
			https: httpsOptions,
			port: 443
		}, callback);
	});

	test.test('HTTPS server with error', (t) => {

		const fakeServer = new Server();
		const httpsOptions = {};
		const someError = Error('Some error');

		const callback = (server) => {
			t.ok(fakeServer._backlog === 'backlog');
			t.ok(fakeServer._busy === true);
			t.ok(fakeServer._hostname === 'hostname');
			t.ok(fakeServer._port === 443);
			t.ok(fakeServer._started === false);
			t.ok(ServerUtils.getTlsOptions.calledOnceWith(httpsOptions));
			t.ok(ServerUtils.runFunction.calledOnceWith(callback, fakeServer));


			server.on('error', (error) => {
				t.ok(error === someError);

				t.ok(ErrorEmitter.emit.calledOnce);

				sandbox.restore();

				t.end();
			});
		};

		sandbox.spy(ServerUtils, 'runFunction');
		sandbox.spy(ErrorEmitter, 'emit');
		sandbox.stub(ServerUtils, 'getTlsOptions').rejects(someError);

		ServerUtils.initServer(fakeServer, {
			backlog: 'backlog',
			hostname: 'hostname',
			https: httpsOptions,
			port: 443
		}, callback);
	});

	test.end();
});