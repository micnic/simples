'use strict';

const tap = require('tap');

const Route = require('simples/lib/route');

tap.test('Route.prototype.constructor()', (test) => {

	const fakeRouter = {};
	const location = '/index';
	const fakeListener = () => null;

	const route = new Route(fakeRouter, location, fakeListener);

	test.ok(route.router === fakeRouter);

	test.end();
});

tap.test('Route.normalizeLocation', (test) => {

	test.ok(Route.normalizeLocation('/abc') === 'abc');
	test.ok(Route.normalizeLocation('abc') === 'abc');

	test.end();
});

tap.test('Route.mixin', (test) => {

	const fakeListener = () => null;
	const staticLocation = '/index';
	const dynamicLocation = '/:index';

	let fakeInstance = {};

	Route.mixin(fakeInstance, staticLocation, fakeListener);

	test.match(fakeInstance, {
		dynamic: false,
		listener: fakeListener,
		location: staticLocation
	});

	fakeInstance = {};

	Route.mixin(fakeInstance, dynamicLocation, fakeListener);

	test.match(fakeInstance, {
		dynamic: true,
		keys: ['index'],
		listener: fakeListener,
		location: dynamicLocation,
		pattern: RegExp('^\\/([^\\/]+)$')
	});

	test.end();
});