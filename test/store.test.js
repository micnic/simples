'use strict';

var simples = require('simples'),
	tap = require('tap');

var Store = require('simples/lib/store');

tap.test('Store without parameters', function (test) {

	var store = simples.store(),
		data = {};

	test.ok(store instanceof Store, 'store is an instance of Store');
	store.set('1234567890', data, function () {
		store.get('1234567890', function (session) {
			test.ok(session === data, 'received session is correct');
			test.end();
		});
	});
});

tap.test('Store with 1 second timeout', function (test) {

	var store = simples.store(1),
		data = {};

	data.expire = Date.now();

	store.set('1234567890', data, function () {
		setTimeout(function () {
			store.get('1234567890', function (session) {
				test.ok(session === null, 'received session is correct');
				test.end();
			});
		}, 1000);
	});
});