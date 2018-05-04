var router = require('./http_router'),
	simples = require('simples');

var server = simples(80, {
	config: {
		session: {
			enabled: true
		},
		static: {
			enabled: true,
			location: __dirname + '/static'
		}
	}
}, function () {
	console.log('HTTP server started');
});

server.mirror(8080);

router(server);