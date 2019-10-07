'use strict';

const { EventEmitter } = require('events');
const { Server } = require('http');
const tap = require('tap');

const simples = require('simples');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('Mirror.prototype.constructor()', (test) => {

	const server = simples();
	const mirror = server.mirror();

	test.ok(mirror instanceof EventEmitter);
	test.match(mirror.data, {});
	test.equal(mirror._meta.backlog, null);
	test.equal(mirror._meta.busy, true);
	test.equal(mirror._meta.hostname, '');
	test.match(mirror._meta.instance, Server);
	test.equal(mirror._meta.port, 80);
	test.equal(mirror._meta.requestListener, server._meta.requestListener);
	test.equal(mirror._meta.started, true);
	test.equal(mirror._meta.upgradeListener, server._meta.upgradeListener);

	test.end();
});

tap.test('Mirror.prototype.start()', (test) => {

	const mirror = simples().mirror();

	test.equal(mirror.start(function (m) {
		test.equal(this, mirror);
		test.equal(m, mirror);

		test.end();
	}), mirror);
});

tap.test('Mirror.prototype.stop()', (test) => {

	const mirror = simples().mirror();

	test.equal(mirror.stop(function (m) {
		test.equal(this, mirror);
		test.equal(m, mirror);

		test.end();
	}), mirror);
});