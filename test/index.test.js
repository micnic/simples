'use strict';

const tap = require('tap');

const simples = require('simples');
const Client = require('simples/lib/client');
const Server = require('simples/lib/server');
const Store = require('simples/lib/session/store');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('simpleS exports', (test) => {

	test.equal(Object.keys(simples).length, 3);
	test.equal(simples, simples.server);
	test.ok(simples() instanceof Server);
	test.ok(simples.server() instanceof Server);
	test.ok(simples.client() instanceof Client);
	test.ok(simples.store() instanceof Store);

	test.end();
});