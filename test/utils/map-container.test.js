'use strict';

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

	test.match(MapContainer.dynamic(), {
		dynamic: new Map(),
		fixed: new Map()
	});

	test.end();
});

tap.test('MapContainer.routes()', (test) => {

	test.match(MapContainer.routes(), {
		all: new Map(),
		delete: new Map(),
		get: new Map(),
		patch: new Map(),
		post: new Map(),
		put: new Map()
	});

	test.end();
});