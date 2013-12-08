var router = require('./utils/router'),
	simples = require('simples');

var server = simples(80, function () {
	console.log('HTTP server started');
});

router(server);