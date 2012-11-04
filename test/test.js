var simples = require('../index.js');
var server = require('../lib/server.js');

i = 0;

var a = simples(80).get('/', function (request, response) {
	response.end('80');
});
/*a.listen(80);
a.routes.get = {
	'/80': function (request, response) {
		response.end('80');
	}
};*/
	/*.get('/', function (request, response) {
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
	});*/



var b = simples(1025).get('/', function (request, response) {
	response.end('1025');
});;
/*b.listen(1025);
b.routes.get = {
	'/1025': function (request, response) {
		response.end('1025');
	}
};*/
//console.log(a.routes, b.routes)
/*.get('/', function (request, response) {
	response.end('root on 1025');
});*/