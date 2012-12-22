var fs = require('fs');
var simples = require('../index');

var server = simples(80);

server.serve(__dirname + '/root')
	.get('/', function (request, response) {
		request.session.name = 'HELLO WORLD';
		response.lang('en');
		fs.createReadStream(__dirname + '/root/index.html').pipe(response);
	})
	.get('/get', function (request, response) {
		console.log(request.session.name);
		response.write('body: ' + request.body + '\n');
		response.write('connection.ip: ' + request.connection.ip + '\n');
		response.write('connection.port: ' + request.connection.port + '\n');
		response.write('cookies: ' + JSON.stringify(request.cookies) + '\n');
		response.write('headers: ' + JSON.stringify(request.headers) + '\n');
		response.write('langs: ' + JSON.stringify(request.langs) + '\n');
		response.write('method: ' + request.method + '\n');
		response.write('query: ' + JSON.stringify(request.query) + '\n');
		response.write('url: ' + JSON.stringify(request.url) + '\n');
		response.end();
	})
	.get('/cookie', function (request, response) {
		Object.keys(request.query).forEach(function (element) {
			response.cookie(element, request.query[element]);
		});
		response.end('Cookies!');
	})
	.get('/json', function (request, response) {
		response.type('json');
		response.send(request);
	})
	.get('/redirect', function (request, response) {
		response.redirect('/succes');
	})
	.get('/succes', function (request, response) {
		response.send('Successful operation');
	})
	.post('/post', function (request, response) {
		response.write('body: ' + request.body + '\n');
		response.write('connection.ip: ' + request.connection.ip + '\n');
		response.write('connection.port: ' + request.connection.port + '\n');
		response.write('cookies: ' + JSON.stringify(request.cookies) + '\n');
		response.write('files: ' + JSON.stringify(request.files) + '\n');
		response.write('headers: ' + JSON.stringify(request.headers) + '\n');
		response.write('langs: ' + JSON.stringify(request.langs) + '\n');
		response.write('method: ' + request.method + '\n');
		response.write('query: ' + JSON.stringify(request.query) + '\n');
		response.write('url: ' + JSON.stringify(request.url) + '\n');
		response.end();
	})
	.error(404, function (request, response) {
		response.send('Error 404 caught');
	})
	.error(500, function (request, response) {
		0 = infinity;
	})
	.get('/error', function (request, response) {
		0 = infinity;
	})
	.ws('/', {
		origins: ['null'],
		protocols: ['echo', ''],
		raw: true
	}, function (connection) {
		console.log(connection.request.session.name);
		connection.on('message', function (message) {
			var data = message.data.toString();console.log('+' + data)
			console.log(data);
			this.send(data);
			this.close();
		});
	});