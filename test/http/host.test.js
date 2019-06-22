'use strict';

const tap = require('tap');

const HTTPHost = require('simples/lib/http/host');
const Router = require('simples/lib/http/router');
const HTTPUtils = require('simples/lib/utils/http-utils');

tap.test('HTTPHost.prototype.constructor()', (test) => {

	const host = new HTTPHost('hostname');

	test.ok(host instanceof Router);
	test.match(host._routers, {
		dynamic: new Map(),
		fixed: new Map()
	});
	test.match(host._routes, HTTPHost.routesContainer());
	test.ok(host._errors.get(500) === HTTPUtils.internalServerError);
	test.ok(host._errors.get(405) === HTTPUtils.methodNotAllowed);
	test.ok(host._errors.get(404) === HTTPUtils.notFound);

	test.end();
});

tap.test('HTTPHost.routesContainer()', (test) => {

	test.match(HTTPHost.routesContainer(), {
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