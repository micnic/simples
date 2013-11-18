var simples = require('simples');

// Start managed server
function serverStart(server, connection) {
	server.start(connection.query.port, function () {
		connection.end();
		console.log('simpleS admin: Server started on port ' + connection.query.port);
	});
}

// Stop managed server
function serverStop(server, connection) {
	server.stop(function () {
		console.log('simpleS admin: Server stopped');
		connection.end();
	});
}

// Export the administration tool
module.exports = function (server, port, auth) {

	// Use port 12345 as the default port for administration
	if (typeof port !== 'number' || port < 1024) {
		port = 12345;
	}

	// Create the administration server
	simples(port).serve('admin').get('/', function (connection) {
		if (connection.session.username) {
			connection.end('HELLO :)');
		} else {
			connection.redirect('/login.html');
		}
	}).post('login', function (connection) {
		if (connection.session.username) {
			connection.redirect('/');
		} else if (connection.query.username && connection.query.password && connection.query.username === auth.username && connection.query.password && auth.password) {
			connection.session.username = connection.query.username;
			connection.session.password = connection.query.password;
			connection.redirect('/');
		} else {
			connection.redirect('/login.html');
		}
	}).post('host', function (connection) {
		var name = connection.query.name;
		server.host(name);
		console.log('simpleS admin: New host created with the name "' + name + '"');
		connection.end();
	}).post('start', function (connection) {
		serverStart(server, connection);
	}).post('stop', function (connection) {
		serverStop(server, connection);
	});
}