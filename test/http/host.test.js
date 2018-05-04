'use strict';

const sinon = require('sinon');
const tap = require('tap');

const HttpHost = require('simples/lib/http/host');
const HttpRouter = require('simples/lib/http/router');
const HttpUtils = require('simples/lib/utils/http-utils');
const constants = require('simples/lib/utils/constants');

const sandbox = sinon.createSandbox();

tap.test('HttpHost.routesContainer()', (test) => {

	test.match(HttpHost.routesContainer(), {
		dynamic: {
			all: new Map(),
			delete: new Map(),
			get: new Map(),
			patch: new Map(),
			post: new Map(),
			put: new Map()
		},
		fixed: {
			all: new Map(),
			delete: new Map(),
			get: new Map(),
			patch: new Map(),
			post: new Map(),
			put: new Map()
		},
		ws: {
			dynamic: new Map(),
			fixed: new Map()
		}
	});

	test.end();
});

tap.test('HttpHost.create()', (test) => {

	const fakeServer = {
		_hosts: {
			dynamic: new Map(),
			fixed: new Map()
		}
	};

	sandbox.spy(HttpHost, 'getPattern');
	sandbox.spy(HttpHost, 'isDynamic');
	sandbox.spy(HttpHost, 'routesContainer');

	test.test('Fixed host', (t) => {

		const host = HttpHost.create(fakeServer, 'host.com');

		t.ok(host instanceof HttpHost);
		t.ok(host instanceof HttpRouter);
		t.ok(host._name === 'host.com');
		t.match(host._routers, {
			dynamic: new Map(),
			fixed: new Map()
		});
		t.match(host._routes, HttpHost.routesContainer());
		t.ok(host._errors.get(constants.internalServerErrorStatusCode) === HttpUtils.internalServerError);
		t.ok(host._errors.get(constants.methodNotAllowedStatusCode) === HttpUtils.methodNotAllowed);
		t.ok(host._errors.get(constants.notFoundStatusCode) === HttpUtils.notFound);

		t.end();
	});

	test.test('Dynamic host', (t) => {

		const host = HttpHost.create(fakeServer, '*.host.com');

		t.ok(host instanceof HttpHost);
		t.ok(host instanceof HttpRouter);
		t.ok(host._name === '*.host.com');
		t.match(host._routers, {
			dynamic: new Map(),
			fixed: new Map()
		});
		t.match(host._routes, HttpHost.routesContainer());
		t.ok(host._dynamic === true);
		t.ok(host._pattern instanceof RegExp);
		t.ok(host._errors.get(constants.internalServerErrorStatusCode) === HttpUtils.internalServerError);
		t.ok(host._errors.get(constants.methodNotAllowedStatusCode) === HttpUtils.methodNotAllowed);
		t.ok(host._errors.get(constants.notFoundStatusCode) === HttpUtils.notFound);

		t.end();
	});

	test.end();
});