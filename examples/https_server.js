var router = require('./utils/router'),
	simples = require('simples');

var server = simples(443, {
	cert: __dirname + '/ssl_certificates/server-cert.pem',
	key: __dirname + '/ssl_certificates/server-key.pem'
}, function () {
	console.log('HTTPS server started');
});

router(server);