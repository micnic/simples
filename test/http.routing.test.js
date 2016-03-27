'use strict';

var tap = require('tap');

var simples = require('simples');

var client = simples.client();

var server = simples();

var counter = function (test, count) {
	return function () {
		if (count) {
			count--;
		}

		if (!count) {
			test.end();
		}
	};
};

var request = function (method, location) {
	return simples.client().request(method, location);
};

var del = function (location) {
	return request('delete', location);
};

var head = function (location) {
	return request('head', location);
};

var get = function (location) {
	return request('get', location);
};

var post = function (location) {
	return request('post', location);
};

var put = function (location) {
	return request('put', location);
};

var responseOk = function (test, response, method, body, expected) {
	test.ok(response.statusCode === 200, method + ' Response status code 200');

	if (body && expected) {
		test.ok(String(body) === expected, method + ' Response body accepted');
	}
};

var testFail = function (test, error, server) {
	test.fail(error.message);
	server.stop(function () {
		test.end();
	});
};

server.on('error', function () {
	// do nothing on error
});

/*tap.test('Virtual hosting', function (test) {
	server.host('127.0.0.1').get('/', function (connection) {
		connection.end('Hello World 2');
	});

	simples.client().get('http://127.0.0.1/').on('error', function (error) {
		test.fail(error.message);
	}).on('body', function (response, body) {
		test.ok(response.statusCode === 200, 'Response status code is 200');
		test.ok(String(body) === 'Hello World 2', 'Response body is "Hello World 2"');

		server.stop(function () {
			test.end();
		});
	});
});*/

tap.test('All routing', function (test) {

	var count = counter(test, 5);

	server.all('/all', function (connection) {
		connection.end('ALL Request');
	});

	head('http://localhost/all').on('error', function (error) {
		testFail(test, error, server);
	}).on('response', function (response) {
		responseOk(test, response, 'HEAD');
		count();
	});

	get('http://localhost/all').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'GET', body, 'ALL Request');
		count();
	});

	post('http://localhost/all').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'POST', body, 'ALL Request');
		count();
	}).end();

	put('http://localhost/all').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'PUT', body, 'ALL Request');
		count();
	}).end();

	del('http://localhost/all').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'DELETE', body, 'ALL Request');
		count();
	}).end();
});

tap.test('GET/HEAD routing', function (test) {

	var count = counter(test, 2);

	server.get('/get', function (connection) {
		connection.end('GET Request');
	});

	head('http://localhost/get').on('error', function (error) {
		testFail(test, error, server);
	}).on('response', function (response) {
		responseOk(test, response, 'HEAD');
		count();
	});

	get('http://localhost/get').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'GET', body, 'GET Request');
		count();
	});
});

tap.test('POST routing', function (test) {

	server.post('/post', function (connection) {
		connection.end('POST Request');
	});

	post('http://localhost/post').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'POST', body, 'POST Request');
		test.end();
	}).end();
});

tap.test('PUT routing', function (test) {

	server.put('/put', function (connection) {
		connection.end('PUT Request');
	});

	put('http://localhost/put').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'PUT', body, 'PUT Request');
		test.end();
	}).end();
});

tap.test('DELETE routing', function (test) {

	server.del('/delete', function (connection) {
		connection.end('DELETE Request');
	});

	del('http://localhost/delete').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'DELETE', body, 'DELETE Request');
		test.end();
	}).end();
});

tap.test('Multiple routes', function (test) {

	var count = counter(test, 2);

	server.get([
		'/get2',
		'/get3'
	], function (connection) {
		connection.end('GET Request');
	});

	get('http://localhost/get2').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'GET', body, 'GET Request');
		count();
	});

	get('http://localhost/get3').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		responseOk(test, response, 'GET', body, 'GET Request');
		count();
	});
});

tap.test('Check 404 error route', function (test) {
	server.error(404, function (connection) {
		connection.end('Error 404 caught');
	});
	get('http://localhost/').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		test.ok(response.statusCode === 404, 'Response status code is 404');
		test.ok(String(body) === 'Error 404 caught', 'Response body accepted');

		test.end();
	}).end();
});

tap.test('Check 405 error route', function (test) {
	server.error(405, function (connection) {
		connection.end('Error 405 caught');
	});
	request('trace', 'http://localhost/get').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		test.ok(response.statusCode === 405, 'Response status code should be 405');
		test.ok(String(body) === 'Error 405 caught', 'Response body accepted');

		test.end();
	}).end();
});

tap.test('Check 500 error route', function (test) {
	server.get('/error', function (connection) {
		error();
	}).error(500, function (connection) {
		connection.end('Error 500 caught');
	});
	get('http://localhost/error').on('error', function (error) {
		testFail(test, error, server);
	}).on('body', function (response, body) {
		test.ok(response.statusCode === 500, 'Response status code is 500');
		test.ok(String(body) === 'Error 500 caught', 'Response is "Error 500 caught"');

		test.end();
	}).end();
});

tap.tearDown(function () {
	server.stop();
});