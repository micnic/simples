'use strict';

const tap = require('tap');

const TypeUtils = require('simples/lib/utils/type-utils');

tap.test('TypeUtils.getContentType()', (test) => {

	test.equal(TypeUtils.getContentType('UNDEFINED'), 'application/octet-stream');
	test.equal(TypeUtils.getContentType('BIN'), 'application/octet-stream');
	test.equal(TypeUtils.getContentType('TXT'), 'text/plain;charset=utf-8');
	test.equal(TypeUtils.getContentType('.BIN'), 'application/octet-stream');
	test.equal(TypeUtils.getContentType('.TXT'), 'text/plain;charset=utf-8');

	test.end();
});