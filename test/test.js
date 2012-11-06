var assert = require('assert');
var http = require('http');

//var server = require('../lib/server.js');
var simples = require('../index.js');

/*var s = server();
s.listen(80);
s.routes.get['/'] = function (request, response) {
	response.write('Hello');
	response.end('World');
}

var t = server();
t.listen(1111);
t.routes.get['/'] = function (request, response) {
	response.write('Hello');
	response.end('World2');
}*/

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
	console.log('Testing response on :80/');
	assert(response.statusCode === 200, 'Status code is ' + response.statusCode + ' [200]');
	assert(response.httpVersion === '1.1', 'HTTP version is ' + response.httpVersion + ' [1.1]');
	assert(response.headers['content-type'] === 'text/html;charset=utf-8', 'Content type is ' + response.headers['content-type'] + ' [text/html;charset=utf-8]');
	assert(response.headers['transfer-encoding'] === 'chunked', 'Content type is ' + response.headers['transfer-encoding'] + ' [chunked]');
	first.stop();
	second.stop();
	third.stop();
}).end();