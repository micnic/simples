'use strict';

const sinon = require('sinon');
const tap = require('tap');

const HttpHost = require('simples/lib/http/host');
const HttpRouter = require('simples/lib/http/router');
const Route = require('simples/lib/route');
const WsHost = require('simples/lib/ws/host');

const { EventEmitter } = require('events');

tap.test('HttpRouter.optionsContainer()', (test) => {

	test.match(HttpRouter.optionsContainer(), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: 5000
	});

	test.match(HttpRouter.optionsContainer({}), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: 5000
	});

	test.match(HttpRouter.optionsContainer({}, {}), {
		compression: {},
		cors: {},
		logger: {},
		session: {},
		timeout: 5000
	});

	test.end();
});

tap.test('HttpRouter.isDynamic()', (test) => {

	test.ok(HttpRouter.isDynamic('/path/*'));
	test.ok(!HttpRouter.isDynamic('/path/to'));

	test.end();
});

tap.test('HttpRouter.getLocation', (test) => {
	test.ok(HttpRouter.getLocation('/absolute/', '/relative/') === '/absolute/relative/');

	test.end();
});

tap.test('HttpRouter.getPattern()', (test) => {

	const pattern = HttpRouter.getPattern('*');

	test.ok(pattern instanceof RegExp);
	test.ok(pattern.toString() === '/^.*?$/');

	test.end();
});

tap.test('HttpRouter.create()', (test) => {

	const host = new HttpHost();
	const fakeOptionsContainer = {};
	const fakePattern = /^.*?$/;

	sinon.stub(HttpRouter, 'getPattern').returns(fakePattern);
	sinon.spy(HttpRouter, 'isDynamic');
	sinon.stub(HttpRouter, 'optionsContainer').returns(fakeOptionsContainer);

	let router = HttpRouter.create(host, null, '', null);

	test.ok(router instanceof HttpRouter);
	test.ok(router instanceof EventEmitter);
	test.match(router.data, {});
	test.ok(router._engine === null);
	test.match(router._errors, new Map());
	test.ok(router._host === router);
	test.ok(router._location === '');
	test.match(router._middlewares, new Set());
	test.ok(router._options === fakeOptionsContainer);
	test.ok(HttpRouter.optionsContainer.calledOnce);
	test.ok(router._parent === null);
	test.ok(HttpRouter.isDynamic.calledOnce);

	const parentRouter = router;

	router = HttpRouter.create(host, parentRouter, '*', null);

	test.ok(router instanceof HttpRouter);
	test.ok(router instanceof EventEmitter);
	test.match(router.data, {});
	test.ok(router._engine === null);
	test.match(router._errors, new Map());
	test.ok(router._host === parentRouter);
	test.ok(router._location === '*');
	test.match(router._middlewares, new Set());
	test.ok(router._options === fakeOptionsContainer);
	test.ok(HttpRouter.optionsContainer.calledTwice);
	test.ok(router._parent === parentRouter);
	test.ok(router._pattern === fakePattern);
	test.ok(HttpRouter.isDynamic.calledTwice);
	test.ok(HttpRouter.getPattern.calledOnce);

	HttpRouter.getPattern.restore();
	HttpRouter.isDynamic.restore();
	HttpRouter.optionsContainer.restore();

	test.end();
});

tap.test('HttpRouter.getListener()', (test) => {

	const emptyImportObject = {};
	const noopListener = () => null;
	const viewLocation = 'index';

	const noopImporter = (connection, callback) => {
		callback(emptyImportObject);
	};

	test.ok(HttpRouter.getListener(noopListener) === noopListener);

	const fakeConnection = {
		render: sinon.stub()
	};

	let listener = HttpRouter.getListener(viewLocation, emptyImportObject);

	test.ok(typeof listener === 'function');
	test.ok(listener.length === 1);

	listener(fakeConnection);

	test.ok(fakeConnection.render.withArgs(viewLocation, emptyImportObject).calledOnce);

	listener = HttpRouter.getListener(viewLocation, noopImporter);

	listener(fakeConnection);

	test.ok(fakeConnection.render.withArgs(viewLocation, emptyImportObject).calledTwice);

	test.end();
});

tap.test('HttpRouter.setRoute()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host, host, '', null);
	const fakeFixedRoute = { dynamic: false };
	const fakeDynamicRoute = { dynamic: true };

	sinon.stub(Route, 'create').returns(fakeFixedRoute);
	sinon.stub(Route, 'normalizeLocation').returns('');

	HttpRouter.setRoute(router);

	HttpRouter.setRoute(router, 'all', '', () => {});

	test.ok(host._routes.fixed['all'].get('') === fakeFixedRoute);
	test.ok(Route.normalizeLocation.calledOnce);
	test.ok(Route.create.calledOnce);

	Route.create.returns(fakeDynamicRoute);

	HttpRouter.setRoute(router, 'all', '', () => {});

	test.ok(host._routes.dynamic['all'].get('') === fakeDynamicRoute);
	test.ok(Route.normalizeLocation.calledTwice);
	test.ok(Route.create.calledTwice);

	Route.create.restore();
	Route.normalizeLocation.restore();

	test.end();
});

tap.test('HttpRouter.isValidErrorCode()', (test) => {

	let result = HttpRouter.isValidErrorCode(100);

	test.ok(result === false);

	result = HttpRouter.isValidErrorCode(40);

	test.ok(result === false);

	result = HttpRouter.isValidErrorCode(400);

	test.ok(result === true);

	result = HttpRouter.isValidErrorCode(500);

	test.ok(result === true);

	test.end();
});

tap.test('HttpRouter.prototype.all()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host);

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'setRoute');

	const result = router.all(routeLocation, listener, importer);

	test.ok(HttpRouter.getListener.withArgs(listener, importer).calledOnce);
	test.ok(HttpRouter.setRoute.withArgs(router, 'all', routeLocation, listener));
	test.ok(result === router);

	HttpRouter.getListener.restore();
	HttpRouter.setRoute.restore();

	test.end();
});

tap.test('HttpRouter.prototype.delete()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host);

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'setRoute');

	const result = router.delete(routeLocation, listener, importer);

	test.ok(HttpRouter.getListener.withArgs(listener, importer).calledOnce);
	test.ok(HttpRouter.setRoute.withArgs(router, 'delete', routeLocation, listener));
	test.ok(result === router);

	HttpRouter.getListener.restore();
	HttpRouter.setRoute.restore();

	test.end();
});

tap.test('HttpRouter.prototype.get()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host);

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'setRoute');

	const result = router.get(routeLocation, listener, importer);

	test.ok(HttpRouter.getListener.withArgs(listener, importer).calledOnce);
	test.ok(HttpRouter.setRoute.withArgs(router, 'get', routeLocation, listener));
	test.ok(result === router);

	HttpRouter.getListener.restore();
	HttpRouter.setRoute.restore();

	test.end();
});

tap.test('HttpRouter.prototype.patch()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host);

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'setRoute');

	const result = router.patch(routeLocation, listener, importer);

	test.ok(HttpRouter.getListener.withArgs(listener, importer).calledOnce);
	test.ok(HttpRouter.setRoute.withArgs(router, 'patch', routeLocation, listener));
	test.ok(result === router);

	HttpRouter.getListener.restore();
	HttpRouter.setRoute.restore();

	test.end();
});

tap.test('HttpRouter.prototype.post()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host);

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'setRoute');

	const result = router.post(routeLocation, listener, importer);

	test.ok(HttpRouter.getListener.withArgs(listener, importer).calledOnce);
	test.ok(HttpRouter.setRoute.withArgs(router, 'post', routeLocation, listener));
	test.ok(result === router);

	HttpRouter.getListener.restore();
	HttpRouter.setRoute.restore();

	test.end();
});

tap.test('HttpRouter.prototype.put()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host);

	const routeLocation = '';
	const listener = () => {};
	const importer = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'setRoute');

	const result = router.put(routeLocation, listener, importer);

	test.ok(HttpRouter.getListener.withArgs(listener, importer).calledOnce);
	test.ok(HttpRouter.setRoute.withArgs(router, 'put', routeLocation, listener));
	test.ok(result === router);

	HttpRouter.getListener.restore();
	HttpRouter.setRoute.restore();

	test.end();
});

tap.test('HttpRouter.prototype.error()', (test) => {

	const host = new HttpHost();
	const fakeListener = () => {};
	const invalidListener = null;

	sinon.stub(HttpRouter, 'getListener').returnsArg(0);
	sinon.stub(HttpRouter, 'isValidErrorCode').returns(false);

	const router = HttpRouter.create(host);

	router.error(0);

	test.ok(HttpRouter.isValidErrorCode.calledOnce);

	HttpRouter.isValidErrorCode.returns(true);

	router.error(400, invalidListener, null);

	test.ok(HttpRouter.isValidErrorCode.calledTwice);
	test.ok(HttpRouter.getListener.calledOnce);

	router.error(400, fakeListener, null);

	test.ok(HttpRouter.isValidErrorCode.calledThrice);
	test.ok(HttpRouter.getListener.calledTwice);
	test.ok(router._errors.get(400) === fakeListener);

	test.end();
});

tap.test('HttpRouter.prototype.engine()', (test) => {

	test.test('Invalid engine', (t) => {

		const host = new HttpHost();
		const router = HttpRouter.create(host);

		router.engine({});

		t.ok(router._engine === null);

		t.end();
	});

	test.test('Valid engine', (t) => {

		const host = new HttpHost();
		const router = HttpRouter.create(host);

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

tap.test('HttpRouter.prototype.use()', (test) => {

	test.test('Invalid middleware', (t) => {

		const host = new HttpHost();
		const router = HttpRouter.create(host);

		router.use(null);

		test.ok(router._middlewares.size === 0);

		t.end();
	});

	test.test('Valid middleware', (t) => {

		const host = new HttpHost();
		const router = HttpRouter.create(host);

		router.use(() => null);

		test.ok(router._middlewares.size === 1);

		t.end();
	});

	test.end();
});

tap.test('HttpRouter.prototype.router()', (test) => {

	const host = new HttpHost();
	const fixedRouter = HttpRouter.create(host, host, '/path/');
	const dynamicRouter = HttpRouter.create(host, host, '/path/*/');

	test.test('Empty input', (t) => {

		try {
			host.router();
		} catch (error) {
			t.ok(error instanceof TypeError);
		}

		t.end();
	});

	test.test('Host main router', (t) => {
		t.ok(host.router('/') === host);
		t.end();
	});

	test.test('Fixed router root subrouter', (t) => {
		t.ok(fixedRouter.router('/') === fixedRouter);
		t.end();
	});

	test.test('Dynamic router root subrouter', (t) => {
		t.ok(dynamicRouter.router('/') === dynamicRouter);
		t.end();
	});

	test.test('Create a new router', (t) => {
		t.ok(host.router('/new') === host.router('/new/'));
		t.end();
	});

	test.end();
});

tap.test('HttpRouter.prototype.ws()', (test) => {

	const host = new HttpHost();
	const router = HttpRouter.create(host, host, '/path/');

	test.test('Empty input', (t) => {
		t.ok(router.ws() === null);
		t.end();
	});

	test.test('Only location provided', (t) => {

		t.ok(router.ws('/') === null);
		t.end();
	});

	test.test('Location and listener provided', (t) => {

		const wsHost = router.ws('/', () => null);

		t.ok(wsHost instanceof WsHost);

		t.end();
	});

	test.test('Existing fixed WS host', (t) => {

		t.ok(host._routes.ws.fixed.get('/path/') === router.ws('/'));

		t.end();
	});

	test.test('Existing fixed WS host', (t) => {

		const wsHost = router.ws('/*/', () => null);

		t.ok(wsHost === router.ws('/*/'));

		t.end();
	});

	test.test('Options provided', (t) => {

		const wsHost = router.ws('/', {});

		t.ok(wsHost === router.ws('/'));

		t.end();
	});

	test.test('Options and listener provided', (t) => {

		const wsHost = router.ws('/', {}, () => null);

		t.ok(wsHost === router.ws('/'));

		t.end();
	});

	test.end();
});