var assert = require('assert');
var http = require('http');

var simples = require('../index.js');

// First server
var first = simples(80).get('/', function (request, response) {
	response.write('Hello');
	response.end('World');
});

// Second server
var second = simples(1111).get('/', function (request, response) {
	response.end('HelloWorld2');
});

// Third server to be sure we can create more than 2 servers
var third = simples(2222);

http.request({
	host: 'localhost',
	method: 'GET',
	path: '/',
	port: 80,
}, function (response) {
	var content = '';

	assert(response.headers['content-type'] === 'text/html;charset=utf-8', 'Content type is ' + response.headers['content-type']);

	response.on('data', function (data) {
		content += data.toString();
	});

	response.on('end', function () {
		assert(content === 'HelloWorld', 'Response content is ' + content);
	})

	first.stop();
	second.stop();
	third.stop();
}).end();

/*http.request({
	host: 'localhost',
	method: 'GET',
	path: '/',
	port: 11111,
}, function (response) {
	var content = '';

	assert(response.headers['content-type'] === 'text/html;charset=utf-8', 'Content type is ' + response.headers['content-type']);

	response.on('data', function (data) {
		content += data.toString();
	});

	response.on('end', function () {
		assert(content === 'HelloWorld2', 'Response content is ' + content);
	})

	second.stop();
}).end();*/

/*http.request({
	host: 'localhost',
	method: 'GET',
	path: '/',
	port: 22222,
}, function (response) {
	var content = '';

	assert(response.headers['content-type'] === 'text/html;charset=utf-8', 'Content type is ' + response.headers['content-type']);

	response.on('data', function (data) {
		content += data.toString();
	});

	response.on('end', function () {
		assert(content === 'HelloWorld2', 'Response content is ' + content);
	})

	third.stop();
}).end();*/