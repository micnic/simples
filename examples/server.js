const simples = require('simples');

const routing = require('./routing');

simples({
	config: {
		compression: {
			enabled: true
		},
		session: {
			enabled: true
		},
		static: {
			enabled: true,
			location: __dirname + '/static'
		}
	},
	https: {
		cert: __dirname + '/ssl_certificates/server-cert.pem',
		key: __dirname + '/ssl_certificates/server-key.pem'
	}
}, (server) => {

	server.mirror(() => {
		console.log('Server started on port 80');
	}).on('error', (error) => {
		console.log('Error in mirror on port 80');
		console.log(error.stack);
	});

	server.mirror(8080, () => {
		console.log('Server started on port 8080');
	}).on('error', (error) => {
		console.log('Error in mirror on port 8080');
		console.log(error.stack);
	});

	server.on('error', (error) => {
		console.log('Error in the main server');
		console.log(error.stack);
	});

	routing(server);

	console.log('Server started on port 443');
});