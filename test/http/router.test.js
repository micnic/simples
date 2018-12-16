'use strict';

const tap = require('tap');
const TestUtils = require('simples/test/test-utils');

const HTTPHost = require('simples/lib/http/host');
const Router = require('simples/lib/http/router');
const Route = require('simples/lib/route');
const WSHost = require('simples/lib/ws/host');

const { EventEmitter } = require('events');

TestUtils.mockHTTPServer();

tap.test('Router.optionsContainer()', (test) => {

	test.match(Router.optionsContainer(), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: 5000
	});

	test.match(Router.optionsContainer({}), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: 5000
	});

	test.match(Router.optionsContainer({}, {}), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: 5000
	});

	test.end();
});

tap.test('Router.isDynamic()', (test) => {

	test.ok(Router.isDynamic('/path/*'));
	test.ok(!Router.isDynamic('/path/to'));

	test.end();
});

tap.test('Router.getLocation', (test) => {
	test.ok(Router.getLocation('/absolute/', '/relative/') === '/absolute/relative/');

	test.end();
});

tap.test('Router.getPattern()', (test) => {

	const pattern = Router.getPattern('*');

	test.ok(pattern instanceof RegExp);
	test.ok(pattern.toString() === '/^.*?$/');

	test.end();
});

tap.test('Router.create()', (test) => {

	const host = HTTPHost.create('hostname');

	let router = Router.create(host, '', null);

	test.ok(router instanceof Router);
	test.ok(router instanceof EventEmitter);
	test.match(router, {
		data: {}
	});

	const parentRouter = router;

	router = Router.create(parentRouter, '*', null);

	test.ok(router instanceof Router);
	test.ok(router instanceof EventEmitter);
	test.match(router, {
		data: {}
	});

	test.end();
});

tap.test('Router.setRoute()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '', null);

	Router.setRoute(router);

	Router.setRoute(router, 'all', '/', () => {});

	test.ok(host._routes.fixed['all'].get('') instanceof Route);

	Router.setRoute(router, 'all', '/*', () => {});

	test.ok(host._routes.dynamic['all'].get('*') instanceof Route);

	test.end();
});

tap.test('Router.isValidErrorCode()', (test) => {

	let result = Router.isValidErrorCode(100);

	test.ok(result === false);

	result = Router.isValidErrorCode(40);

	test.ok(result === false);

	result = Router.isValidErrorCode(400);

	test.ok(result === true);

	result = Router.isValidErrorCode(500);

	test.ok(result === true);

	test.end();
});

tap.test('Router.prototype.all()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.all(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.delete()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.delete(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.get()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.get(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.patch()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.patch(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.post()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.post(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.put()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.put(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.error()', (test) => {

	const host = HTTPHost.create('hostname');
	const fakeListener = () => {};
	const invalidListener = null;

	const router = Router.create(host, '');

	router.error(0);

	router.error(400, invalidListener, null);

	router.error(400, fakeListener, null);
	test.ok(router._errors.get(400) === fakeListener);

	test.end();
});

tap.test('Router.prototype.engine()', (test) => {

	test.test('Invalid engine', (t) => {

		const host = HTTPHost.create('hostname');
		const router = Router.create(host, '');

		router.engine({});

		t.ok(router._engine === null);

		t.end();
	});

	test.test('Valid engine', (t) => {

		const host = HTTPHost.create('hostname');
		const router = Router.create(host, '');

		const fakeEngine = {
			render() {
				return null;
			}
		};

		router.engine(fakeEngine);

		t.ok(router._engine === fakeEngine);

		t.end();
	});

	test.end();
});

tap.test('Router.prototype.use()', (test) => {

	test.test('Invalid middleware', (t) => {

		const host = HTTPHost.create('hostname');
		const router = Router.create(host, '');

		router.use(null);

		test.ok(router._middlewares.size === 0);

		t.end();
	});

	test.test('Valid middleware', (t) => {

		const host = HTTPHost.create('hostname');
		const router = Router.create(host, '');

		router.use(() => null);

		test.ok(router._middlewares.size === 1);

		t.end();
	});

	test.end();
});

tap.test('Router.prototype.router()', (test) => {

	const host = HTTPHost.create('hostname');

	test.test('Empty input', (t) => {

		host.on('error', (error) => {

			t.ok(error instanceof TypeError);
		});

		host.router();

		t.end();
	});

	test.end();
});

tap.test('Router.prototype.static()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	router.static();

	test.end();
});

tap.test('Router.prototype.timeout()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '');

	router.timeout(0);

	test.equal(router._options.timeout, 0);

	test.end();
});

tap.test('Router.prototype.ws()', (test) => {

	const host = HTTPHost.create('hostname');
	const router = Router.create(host, '/path/');

	test.test('Empty input', (t) => {
		t.ok(router.ws() === null);
		t.end();
	});

	test.test('Only location provided', (t) => {

		t.ok(router.ws('/') === null);
		t.end();
	});

	test.test('Location and options provided', (t) => {

		t.ok(router.ws('/', {}) === null);
		t.end();
	});

	test.test('Location and listener provided', (t) => {

		const wsHost = router.ws('/', () => null);

		t.ok(wsHost instanceof WSHost);

		t.end();
	});

	test.end();
});