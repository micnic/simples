module.exports = function (server) {

	server.on('error', function (error) {
		console.log(error);
	});

	// Add a middleware
	server.middleware(function (connection, next) {

		// Log connection when all data is written
		connection.on('finish', function () {
			connection.log('%ip %method %status %protocol://%host%path');
		});

		// Add "X-Powered-By" header
		connection.header('X-Powered-By', 'simpleS');

		// End the current middleware
		next();
	});

	// Set the static content
	server.serve(__dirname + '/static');

	// Set GET root index route
	server.get('/', function (connection) {
		connection.drain(__dirname + '/static/index.html');
	});

	// Set GET routes for "/home" and "/index" to redirect
	server.get([
		'/home',
		'/index'
	], function (connection) {
		connection.redirect('/index.html');
	});

	// Set GET route to "/hello"
	server.get('/hello', function (connection) {
		connection.write('Hello simpleS');
		connection.end();
	});

	// Set GET route to "/json"
	server.get('/json', function (connection) {
		connection.type('json');
		connection.send({
			cookies: connection.cookies,
			data: connection.data,
			headers: connection.headers,
			host: connection.host,
			ip: connection.ip,
			langs: connection.langs,
			method: connection.method,
			params: connection.params,
			path: connection.path,
			protocol: connection.protocol,
			query: connection.query,
			session: connection.session,
			url: connection.url
		}, null, '    ');
	});

	// Set GET route for "/upload"
	server.get('/upload', function (connection) {
		connection.drain(__dirname + '/static/upload.html');
	});

	// Set POST route for "/upload"
	server.post('/upload', function (connection) {

		// Set "text/plain" content type header
		connection.type('txt');

		// Parse received data
		connection.parse({

			limit: 1024,

			json: function () {
				form.on('end', function () {
					connection.send(form.result, null, '    ');
				}).on('error', function (error) {
					console.log(error);
				});
			},

			multipart: function (form) {
				form.on('field', function (field) {
					connection.write(field.name + '\n');
					field.on('readable', function () {
						connection.write((this.read() || Buffer(0)).slice(0, 32).toString('hex') + '\n');
					}).on('end', function () {
						connection.write('----------\n');
					}).on('error', function (error) {
						console.log(error);
					});
				}).on('end', function () {
					connection.end();
				}).on('error', function (error) {
					console.log(error);
				});
			},

			plain: function (form) {
				form.on('readable', function () {
					connection.write((this.read() || Buffer(0)).slice(0, 32).toString('hex'));
				}).on('end', function () {
					connection.end();
				}).on('error', function (error) {
					console.log(error);
				});
			},

			urlencoded: function (form) {
				form.on('end', function () {
					connection.send(form.result, null, '    ');
				}).on('error', function (error) {
					console.log(error);
				});
			}
		});
	});

	// Set route to WebSocket echo example
	server.get('/ws_echo', function (connection) {
		connection.drain(__dirname + '/static/ws_echo.html');
	});

	// Set WebSocket host for "/echo"
	server.ws('/echo', {
		limit: 10
	}, function (connection) {
		connection.on('message', function (message) {
			connection.send(message.data);
		});
	});

	// Set route to WebSocket chat example
	server.get('/ws_chat', function (connection) {
		connection.drain(__dirname + '/static/ws_chat.html');
	});

	server.ws('/chat', function (connection) {

	});
};