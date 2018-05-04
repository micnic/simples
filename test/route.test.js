'use strict';

const sinon = require('sinon');
const tap = require('tap');

const Route = require('simples/lib/route');

tap.test('Route.isDynamic', (test) => {

	test.ok(!Route.isDynamic('/path/to/route'));
	test.ok(Route.isDynamic('/:param/*'));

	test.end();
});

tap.test('Route.normalizeLocation', (test) => {

	test.ok(Route.normalizeLocation('/abc') === 'abc');
	test.ok(Route.normalizeLocation('abc') === 'abc');

	test.end();
});

tap.test('Route.escapeRegExpString', (test) => {

	test.ok(Route.escapeRegExpString('-[]/{}()+?.\\^$|') === '\\-\\[\\]\\/\\{\\}\\(\\)\\+\\?\\.\\\\\\^\\$\\|');

	test.end();
});

tap.test('Route.mixin', (test) => {

	const fakeListener = () => null;
	const staticLocation = '/index';
	const dynamicLocation = '/:index';

	let fakeInstance = {};

	const sandbox = sinon.createSandbox();

	sandbox.stub(Route, 'isDynamic')
		.withArgs(staticLocation).returns(false)
		.withArgs(dynamicLocation).returns(true);

	Route.mixin(fakeInstance, staticLocation, fakeListener);

	test.match(fakeInstance, {
		dynamic: false,
		listener: fakeListener,
		location: staticLocation
	});

	test.ok(Route.isDynamic.withArgs(staticLocation).calledOnce);

	sandbox.stub(Route, 'escapeRegExpString').returnsArg(0);

	fakeInstance = {};

	Route.mixin(fakeInstance, dynamicLocation, fakeListener);

	test.match(fakeInstance, {
		dynamic: true,
		keys: ['index'],
		listener: fakeListener,
		location: dynamicLocation,
		pattern: RegExp('^\\/([^\\/]+)$')
	});

	test.ok(Route.isDynamic.withArgs(dynamicLocation).calledOnce);

	sandbox.restore();

	test.end();
});

tap.test('Route.create', (test) => {

	const fakeRouter = {};
	const location = '/index';
	const fakeListener = () => null;

	const sandbox = sinon.createSandbox();

	sandbox.stub(Route, 'mixin');

	const route = Route.create(fakeRouter, location, fakeListener);

	test.ok(route instanceof Route);
	test.ok(route.router === fakeRouter);
	test.ok(Route.mixin.withArgs(sinon.match.instanceOf(Route), location, fakeListener).calledOnce);

	sandbox.restore();

	test.end();
});