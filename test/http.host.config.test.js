'use strict';

var simples = require('simples'),
	tap = require('tap');

var server = simples();

var client = simples.client();

var get = client.get.bind(client);

server.get('/', function (connection) {
	connection.type('txt').end('simpleS');
});

tap.test('Host undefined configuration', function (test) {
	server.config();

	get('http://localhost/', {
		headers: {
			'Accept-Encoding': 'gzip, deflate'
		}
	}).on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		test.ok(!response.headers['content-encoding'], 'No content encoding');
		test.ok(String(body) === 'simpleS', 'Response body expected');
		test.end();
	});
});

tap.test('Host null configuration', function (test) {
	server.config(null);

	get('http://localhost/', {
		headers: {
			'Accept-Encoding': 'gzip, deflate'
		}
	}).on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		test.ok(!response.headers['content-encoding'], 'No content encoding');
		test.ok(String(body) === 'simpleS', 'Response body expected');
		test.end();
	});
});

tap.test('Host compression enabled', function (test) {
	server.config({
		compression: {
			enabled: true
		}
	});

	get('http://localhost/', {
		headers: {
			'Accept-Encoding': 'gzip, deflate'
		}
	}).on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		test.ok(response.headers['content-encoding'] === 'Deflate', 'Default preffered is Deflate');
		test.ok(String(body) === 'simpleS', 'Response body is decompressed correctly');
		test.end();
	});
});

tap.test('Host compression filter', function (test) {
	server.config({
		compression: {
			filter: /^text\/html$/
		}
	});

	get('http://localhost/', {
		headers: {
			'Accept-Encoding': 'gzip, deflate'
		}
	}).on('error', function (error) {
		test.fail(error.message);
	}).once('body', function (response, body) {
		test.ok(!response.headers['content-encoding'], 'No content encoding');
		test.ok(String(body) === 'simpleS', 'Response body expected');
		test.end();
	});
});

tap.tearDown(function () {
	server.stop();
});