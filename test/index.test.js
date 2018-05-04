'use strict';

const sinon = require('sinon');
const tap = require('tap');

const simples = require('simples');
const Client = require('simples/lib/client/client');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');
const Store = require('simples/lib/store/store');

tap.test('simpleS exports', (test) => {

	test.test('simples.server()', (t) => {

		sinon.stub(ServerUtils, 'initServer');

		simples();

		tap.ok(simples !== Server.create);
		tap.ok(ServerUtils.initServer.calledOnce);

		ServerUtils.initServer.restore();

		t.end();
	});

	tap.ok(simples.server === Server.create);
	tap.ok(simples.client === Client.create);
	tap.ok(simples.store === Store.create);
	tap.ok(Object.keys(simples).length === 3);

	test.end();
});