'use strict';

const { Server } = require('http');
const tap = require('tap');

const simples = require('simples');
const HTTPHost = require('simples/lib/http/host');
const MapContainer = require('simples/lib/utils/map-container');
const Mirror = require('simples/lib/mirror');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('Server.prototype.constructor()', (test) => {

	const server = simples();

	test.ok(server instanceof HTTPHost);
	test.match(server._hosts, MapContainer.dynamic());
	test.equal(server._meta.backlog, null);
	test.equal(server._meta.busy, true);
	test.equal(server._meta.hostname, '');
	test.match(server._meta.instance, Server);
	test.equal(server._meta.port, 80);
	test.match(server._meta.requestListener, Function);
	test.equal(server._meta.started, true);
	test.match(server._meta.upgradeListener, Function);

	test.end();
});

tap.test('Server.prototype.host()', (test) => {

	const server = simples();

	test.test('No host name provided', (t) => {
		t.equal(server.host(), null);

		t.end();
	});

	test.test('Create a new fixed host', (t) => {

		const host = server.host('hostname');

		t.ok(host instanceof HTTPHost);
		t.equal(server._hosts.fixed.get('hostname'), host);

		t.end();
	});

	test.test('Create a new dynamic host', (t) => {

		const host = server.host('*.hostname');

		t.ok(host instanceof HTTPHost);
		t.equal(server._hosts.dynamic.get('*.hostname'), host);

		t.end();
	});

	test.end();
});

tap.test('Server.prototype.mirror()', (test) => {

	test.ok(simples().mirror() instanceof Mirror);

	test.end();
});

tap.test('Server.prototype.start()', (test) => {

	const server = simples();

	test.equal(server.start(function (s) {
		test.equal(this, server);
		test.equal(s, server);

		test.end();
	}), server);
});

tap.test('Server.prototype.stop()', (test) => {

	const server = simples();

	test.equal(server.stop(function (s) {
		test.equal(this, server);
		test.equal(s, server);

		test.end();
	}), server);
});