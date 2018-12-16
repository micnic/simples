'use strict';

const tap = require('tap');

const HTTPHost = require('simples/lib/http/host');
const HTTPUtils = require('simples/lib/utils/http-utils');
const constants = require('simples/lib/utils/constants');

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

tap.test('HTTPHost.create()', (test) => {

	const host = HTTPHost.create('hostname');

	test.ok(host instanceof HTTPHost);
	test.match(host._routers, {
		dynamic: new Map(),
		fixed: new Map()
	});
	test.match(host._routes, HTTPHost.routesContainer());
	test.ok(host._errors.get(constants.internalServerErrorStatusCode) === HTTPUtils.internalServerError);
	test.ok(host._errors.get(constants.methodNotAllowedStatusCode) === HTTPUtils.methodNotAllowed);
	test.ok(host._errors.get(constants.notFoundStatusCode) === HTTPUtils.notFound);

	test.end();
});