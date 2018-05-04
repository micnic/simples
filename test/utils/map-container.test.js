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