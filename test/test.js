var assert = require('assert');
var http = require('http');

var simples = require('../index.js');

// First server
var first = simples(80).get('/', function (request, response) {
	//console.log(require('util').inspect(request.body, true, null, true));
	response.write('Hello');
	response.end('World');
}).serve('root');

// Second server
var second = simples(1111).get('/', function (request, response) {
	response.end('HelloWorld2');
});

// Third server to be sure we can create more than 2 servers
var third = simples(2222).all('/', function (request, response) {
	console.log(require('util').inspect(request.cookies, true, null, true));
	response.end();
});

/*var req = http.request({
	headers: {
		'Content-Type': '123'
	},
	host: 'localhost',
	method: 'post',
	path: '/',
	port: 80,
}, function (response) {
	var content = '';

	assert(response.headers['content-type'] === 'text/html;charset=utf-8', 'Content type is ' + response.headers['content-type']);

	response.on('data', function (data) {
		content += data.toString();
	});

	response.on('end', function () {
		console.log(response.statusCode);
		console.log(content);
		//console.log(require('util').inspect(response.headers, true, null, true));
		//assert(content === 'HelloWorld', 'Response content is ' + content);
	})

	first.stop();
	second.stop();
	third.stop();
}).end();*/

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