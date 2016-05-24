'use strict';

var simples = require('simples'),
	tap = require('tap');

var Host = require('simples/lib/http/host');

var server = simples();

var client = simples.client();

var host = server.host.bind(server);

var head = client.head.bind(client);

var get = client.get.bind(client);

var responseOk = function (test, response, body, expected) {
	test.ok(response.statusCode === 200, 'Response status code is 200');

	if (body && expected) {
		test.ok(String(body) === expected, 'Expected response body');
	}
};

server.on('error', function (error) {
	tap.fail(error.message);
});

server.get('/', function (connection) {
	connection.end('main');
});

host('127.0.0.1').get('/', function (connection) {
	connection.end('127.0.0.1');
});

tap.ok(server instanceof Host, 'server is an instance of Host');
tap.ok(host() === server, 'server is the implicit main host');
tap.ok(host('127.0.0.1') === host('127.0.0.1'), 'host getter check');

tap.test('Request to the main host', function (test) {
	get('http://localhost/').on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		responseOk(test, response, body, 'main');
		test.end();
	});
});

tap.test('Request to a virtual host', function (test) {
	get('http://127.0.0.1/').on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		responseOk(test, response, body, '127.0.0.1');
		test.end();
	});
});

tap.test('Destroy a virtual host', function (test) {
	host('127.0.0.1').destroy();
	get('http://127.0.0.1/').on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		responseOk(test, response, body, 'main');
		test.end();
	});
});

tap.test('Reset the main host', function (test) {
	host().destroy();
	head('http://localhost/').on('error', function (error) {
		test.fail(error.message);
	}).once('response', function (response) {
		test.ok(response.statusCode === 404, 'Response status code is 404');
		test.end();
	});
});

tap.tearDown(function () {
	server.stop();
});