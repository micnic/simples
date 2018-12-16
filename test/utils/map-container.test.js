'use strict';

const sinon = require('sinon');
const tap = require('tap');

const MapContainer = require('simples/lib/utils/map-container');

tap.test('MapContainer.create()', (test) => {

	test.match(MapContainer.create('a', 'b', 'c'), {
		a: new Map(),
		b: new Map(),
		c: new Map()
	});

	test.end();
});

tap.test('MapContainer.dynamic()', (test) => {

	sinon.spy(MapContainer, 'create');

	test.match(MapContainer.dynamic(), {
		dynamic: new Map(),
		fixed: new Map()
	});
	test.ok(MapContainer.create.calledOnceWith('dynamic', 'fixed'));

	MapContainer.create.restore();

	test.end();
});

tap.test('MapContainer.routes()', (test) => {

	sinon.spy(MapContainer, 'create');

	test.match(MapContainer.routes(), {
		all: new Map(),
		delete: new Map(),
		get: new Map(),
		patch: new Map(),
		post: new Map(),
		put: new Map()
	});
	test.ok(MapContainer.create.calledOnceWith('all', 'delete', 'get', 'patch', 'post', 'put'));

	MapContainer.create.restore();

	test.end();
});