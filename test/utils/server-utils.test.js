'use strict';

const sinon = require('sinon');
const tap = require('tap');

const fs = require('fs');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');

tap.test('ServerUtils.getTlsOptions()', (test) => {

	test.test('Resolved promise', (t) => {

		sinon.stub(fs, 'readFile').callsArgWith(1, null, 'content');

		ServerUtils.getTlsOptions({
			cert: 'cert',
			prop: 'prop'
		}).then((config) => {

			t.ok(config.cert === 'content');
			t.ok(config.prop === 'prop');
			t.ok(Object.keys(config).length === 2);

			fs.readFile.restore();

			t.end();
		}).catch(() => {
			t.fail('The promise should not be rejected');
		});
	});

	test.test('Rejected promise', (t) => {

		const someError = Error('Some error');

		sinon.stub(fs, 'readFile').callsArgWith(1, someError);

		ServerUtils.getTlsOptions({
			cert: 'cert'
		}).then(() => {
			t.fail('The promise should not be resolved');
		}).catch((error) => {
			t.ok(error === someError);

			fs.readFile.restore();

			t.end();
		});
	});

	test.end();
});

tap.test('ServerUtils.prepareServerArgs()', (test) => {

	const emptyOptions = {};

	const httpsOptions = {
		https: {
			cert: __dirname + '/ssl/server-cert.pem',
			handshakeTimeout: 60,
			key: __dirname + '/ssl/server-key.pem'
		},
		port: 443
	};

	const noop = () => null;

	test.test('Empty input', (t) => {

		const args = ServerUtils.prepareServerArgs();

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 80 && args.options.port === 80);

		t.end();
	});

	test.test('Port provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Null provided', (t) => {

		const args = ServerUtils.prepareServerArgs(null);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 80 && args.options.port === 80);

		t.end();
	});

	test.test('Empty options provided', (t) => {

		const args = ServerUtils.prepareServerArgs(emptyOptions);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 80 && args.options.port === 80);

		t.end();
	});

	test.test('HTTPS options provided', (t) => {

		const args = ServerUtils.prepareServerArgs(httpsOptions);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 443 && args.options.port === 443);

		t.end();
	});

	test.test('Noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 80 && args.options.port === 80);

		t.end();
	});

	test.test('Port and null provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, null);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Port and empty options provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, emptyOptions);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Port and HTTPS options provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, httpsOptions);

		t.ok(args.callback === null);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Port and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Null and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(null, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 80 && args.options.port === 80);

		t.end();
	});

	test.test('Empty options and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(emptyOptions, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 80 && args.options.port === 80);

		t.end();
	});

	test.test('HTTPS options and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(httpsOptions, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 443 && args.options.port === 443);

		t.end();
	});

	test.test('Port, null and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, null, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Port, empty options and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, emptyOptions, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

		t.end();
	});

	test.test('Port, HTTPS options and noop function provided', (t) => {

		const args = ServerUtils.prepareServerArgs(12345, httpsOptions, noop);

		t.ok(args.callback === noop);
		t.ok(args.options && typeof args.options === 'object');
		t.ok(args.port === 12345 && args.options.port === 12345);

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

		const noop = sinon.spy();

		ServerUtils.runFunction(noop);

		t.ok(noop.calledOnce);

		t.end();
	});

	test.test('With context', (t) => {

		const noop = sinon.spy();
		const context = {};

		ServerUtils.runFunction(noop, context);

		t.ok(noop.calledOnce);
		t.ok(noop.calledOn(context));
		t.ok(noop.calledWith(context));

		t.end();
	});

	test.end();
});

tap.test('ServerUtils.listenPort()', (test) => {

	const fakeServer = new Server();

	sinon.spy(ServerUtils, 'runFunction');

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

		ServerUtils.runFunction.restore();

		test.end();
	});

	ServerUtils.listenPort(fakeServer, 80, () => {

		test.ok(fakeServer._busy === false);
	});
});

tap.test('ServerUtils.stopServer()', (test) => {

	test.test('Inactive server', (t) => {

		const fakeServer = new Server();

		sinon.spy(ServerUtils, 'runFunction');

		fakeServer._busy = false;
		fakeServer._started = false;

		ServerUtils.stopServer(fakeServer, (server) => {

			t.ok(server === fakeServer);
			t.ok(server._busy === false);
			t.ok(server._started === false);
			t.ok(ServerUtils.runFunction.calledOnce);
			t.ok(ServerUtils.runFunction.calledWith(sinon.match.func, fakeServer));

			ServerUtils.runFunction.restore();

			t.end();
		});
	});

	test.test('Started server', (t) => {

		const fakeServer = new Server();

		sinon.spy(ServerUtils, 'runFunction');

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

			ServerUtils.runFunction.restore();

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

		sinon.spy(ServerUtils, 'runFunction');

		fakeServer._busy = true;
		fakeServer._started = false;

		ServerUtils.stopServer(fakeServer, (server) => {

			t.ok(server === fakeServer);
			t.ok(server._busy === false);
			t.ok(server._started === false);
			t.ok(ServerUtils.runFunction.calledOnce);
			t.ok(ServerUtils.runFunction.calledWith(sinon.match.func, fakeServer));

			ServerUtils.runFunction.restore();

			t.end();
		});

		t.ok(ServerUtils.runFunction.notCalled);

		fakeServer._busy = false;
		fakeServer.emit('release');
	});

	test.end();
});