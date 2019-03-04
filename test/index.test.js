'use strict';

const http = require('http');
const simples = require('simples');
const tap = require('tap');

const Client = require('simples/lib/client/client');
const MapContainer = require('simples/lib/utils/map-container');
const Server = require('simples/lib/server');
const ServerUtils = require('simples/lib/utils/server-utils');
const Store = require('simples/lib/store/store');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('simpleS exports', (test) => {

	test.test('simples()', (t) => {

		const server = simples();
		const hosts = Server.getHTTPHosts(server);
		const meta = ServerUtils.getServerMeta(server);

		t.ok(server instanceof Server);
		t.match(server._options, {
			compression: {},
			cors: {},
			logger: {},
			session: {},
			static: {},
			timeout: {}
		});
		t.match(hosts, MapContainer.dynamic());
		t.match(meta, {
			backlog: null,
			busy: true,
			hostname: '',
			https: null,
			instance: http.Server,
			port: 80,
			requestListener: Function,
			started: true,
			upgradeListener: Function
		});
		t.end();
	});

	test.test('simples', (t) => {
		t.match(simples, Function);
		t.equal(simples.server, Server.create);
		t.equal(simples.client, Client.create);
		t.equal(simples.store, Store.create);
		t.equal(Object.keys(simples).length, 3);

		t.end();
	});

	test.end();
});