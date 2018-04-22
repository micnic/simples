'use strict';

const tap = require('tap');

const simples = require('simples');
const Client = require('simples/lib/client/client');
const Server = require('simples/lib/server');
const Store = require('simples/lib/store/store');

tap.test('simpleS exports', (test) => {

	tap.ok(simples === Server.create);
	tap.ok(simples.server === simples);
	tap.ok(simples.client === Client.create);
	tap.ok(simples.store === Store.create);
	tap.ok(Object.keys(simples).length === 3);

	test.end();
});