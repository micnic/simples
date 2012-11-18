var fs = require('fs');
var simples = require('../index');

var server = simples(80)
	.serve('root')
	.get('/', function (request, response) {
		fs.createReadStream('root/index.html').pipe(response);
	})
	.get('/get', function (request, response) {
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
	.post('/post', function (request, response) {console.log(request);
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
	.ws('/', {
		origins: ['http://localhost'],
		protocols: ['echo']
	}, function (connection) {
		connection.on('message', function (message) {
			var data = message.data.toString();
			console.log(data);
			this.send(data);
			this.close();
		});
	});