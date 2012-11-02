var simples = require('../simples.js');

i = 0;

simples(80)
	.get('/', function (request, response) {
		console.log(request.url);
		response.end('get Root');
	})
	.post('/', function (request, response) {
		response.end('post Root');
	})
	.all('/123', function (request, response) {
		response.cookie('name', 'micnic');
		response.end('/index with cookies');
	})
	.getStatic('root')
	.notFound(function (request, response) {
		response.end('Not Found!');
	})
	.ws('/', {origins: ['null'], protocols: ['protocolOne']}, function (connection) {
		connection.id = i++;
		connection.getConnections();
		connection.send();
		connection.broadcast('Vaca paste iarba verde', function (con) {
			return con.id > 3;
		});
		console.log('connection open: ' + connection.getSocket().remoteAddress);
		connection.on('message', function (message) {
			console.log(message.data.toString());
		});
		connection.on('close', function () {
			console.log('connection closed');
		})
	});