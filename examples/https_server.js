var router = require('./http_router'),
	simples = require('simples');

var server = simples(443, {
	config: {
		static: {
			enabled: true,
			location: __dirname + '/static'
		}
	},
	https: {
		cert: __dirname + '/ssl_certificates/server-cert.pem',
		key: __dirname + '/ssl_certificates/server-key.pem'
	}
}, function () {
	console.log('HTTPS server started');
});

router(server);