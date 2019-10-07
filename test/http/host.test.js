'use strict';

const tap = require('tap');

const simples = require('simples');
const Router = require('simples/lib/http/router');
const TestUtils = require('simples/test/test-utils');

TestUtils.mockHTTPServer();

tap.test('HTTPHost.prototype.constructor()', (test) => {

	const host = simples();

	test.ok(host instanceof Router);
	test.match(host._pattern, RegExp);
	test.match(host._routers, {
		dynamic: new Map(),
		fixed: new Map()
	});
	test.match(host._routes, {
		dynamic: {
			all: new Map(),
			delete: new Map(),
			get: new Map(),
			patch: new Map(),
			post: new Map(),
			put: new Map(),
		},
		fixed: {
			all: new Map(),
			delete: new Map(),
			get: new Map(),
			patch: new Map(),
			post: new Map(),
			put: new Map(),
		},
		ws: {
			dynamic: new Map(),
			fixed: new Map()
		}
	});

	test.end();
});