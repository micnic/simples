var admin = require('./admin'),
	simples = require('simples');

admin(simples(1024), 12345, {
	username: 'user',
	password: 'pass'
});