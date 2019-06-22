'use strict';

const tap = require('tap');
const TestUtils = require('simples/test/test-utils');

const HTTPHost = require('simples/lib/http/host');
const Router = require('simples/lib/http/router');
const Route = require('simples/lib/route');
const Store = require('simples/lib/session/store');
const WSHost = require('simples/lib/ws/host');

const { EventEmitter } = require('events');

TestUtils.mockHTTPServer();

tap.test('Router.prototype.constructor()', (test) => {

	const host = new HTTPHost('hostname');

	let router = new Router(host, '', null);

	test.ok(router instanceof EventEmitter);
	test.match(router, {
		data: {}
	});

	const parentRouter = router;

	router = new Router(parentRouter, '*', null);

	test.ok(router instanceof EventEmitter);
	test.match(router, {
		data: {}
	});

	test.end();
});

tap.test('Router.optionsContainer()', (test) => {

	test.match(Router.optionsContainer(), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: {}
	});

	test.match(Router.optionsContainer({}), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: {}
	});

	test.match(Router.optionsContainer({}, {}), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: {}
	});

	test.end();
});

tap.test('Router.getListener', (test) => {

	const noop = () => null;
	const empty = {};

	const fakeConnection = {
		render(view, importer) {
			test.equal(view, 'view');
			test.equal(importer, empty);
		}
	};

	let listener = Router.getListener(noop);

	test.ok(listener === noop);

	listener = Router.getListener('view', empty);

	listener(fakeConnection);

	listener = Router.getListener('view', (connection, callback) => {
		callback(empty);
	});

	listener(fakeConnection);

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

tap.test('Router.prototype.compression()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	router.compression();

	test.match(router._options.compression, {
		enabled: false,
		options: null,
		preferred: 'deflate'
	});

	test.end();
});

tap.test('Router.prototype.cors()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	router.cors();

	test.match(router._options.cors, {
		credentials: false,
		headers: [],
		methods: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
		origins: []
	});

	test.end();
});

tap.test('Router.prototype.logger()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	router.logger();

	test.match(router._options.logger, {
		enabled: false,
		format: '',
		log: null,
		tokens: null
	});

	test.end();
});

tap.test('Router.prototype.session()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	router.session();

	test.match(router._options.session, {
		enabled: false,
		store: Store,
		timeout: 3600000
	});

	test.end();
});

tap.test('Router.setRoute()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '', null);

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

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.all(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.delete()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.delete(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.get()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.get(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.patch()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.patch(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.post()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.post(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.put()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	const result = router.put(routeLocation, listener, importer);

	test.ok(result === router);

	test.end();
});

tap.test('Router.prototype.error()', (test) => {

	const host = new HTTPHost('hostname');
	const fakeListener = () => {};
	const invalidListener = null;

	const router = new Router(host, '');

	router.error(0);

	router.error(400, invalidListener, null);

	router.error(400, fakeListener, null);
	test.ok(router._errors.get(400) === fakeListener);

	test.end();
});

tap.test('Router.prototype.engine()', (test) => {

	test.test('Invalid engine', (t) => {

		const host = new HTTPHost('hostname');
		const router = new Router(host, '');

		router.engine({});

		t.ok(router._engine === null);

		t.end();
	});

	test.test('Valid engine', (t) => {

		const host = new HTTPHost('hostname');
		const router = new Router(host, '');

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

		const host = new HTTPHost('hostname');
		const router = new Router(host, '');

		router.use(null);

		test.ok(router._middlewares.size === 0);

		t.end();
	});

	test.test('Valid middleware', (t) => {

		const host = new HTTPHost('hostname');
		const router = new Router(host, '');

		router.use(() => null);

		test.ok(router._middlewares.size === 1);

		t.end();
	});

	test.end();
});

tap.test('Router.prototype.router()', (test) => {

	const host = new HTTPHost('hostname');

	test.test('Empty input', (t) => {

		t.equal(host.router(), null);

		t.end();
	});

	test.test('Fixed router', (t) => {

		t.ok(host.router('fixed') instanceof Router);

		t.end();
	});

	test.test('Dynamic router', (t) => {

		t.ok(host.router('*') instanceof Router);

		t.end();
	});

	test.end();
});

tap.test('Router.prototype.static()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	router.static();

	test.match(router._options.static, {
		enabled: false,
		index: ['index.html'],
		location: ''
	});

	test.end();
});

tap.test('Router.prototype.timeout()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '');

	router.timeout();

	test.match(router._options.timeout, {
		enabled: false,
		value: null
	});

	test.end();
});

tap.test('Router.prototype.ws()', (test) => {

	const host = new HTTPHost('hostname');
	const router = new Router(host, '/path/');

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