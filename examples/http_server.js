var router = require('./http_router'),
	simples = require('simples');

var server = simples(80, function () {
	console.log('HTTP server started');
});

server.mirror(8080);

router(server);