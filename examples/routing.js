module.exports = (server) => {

	// Add a middleware
	server.use((connection, next) => {

		// Log connection when all data is written
		connection.on('finish', () => {
			connection.log('%ip %method %status %protocol://%host%path');
		});

		// Add "X-Powered-By" header
		connection.header('X-Powered-By', 'simpleS');

		// End the current middleware
		next();
	});

	// Set GET root index route
	server.get('/', (connection) => {
		connection.drain(__dirname + '/static/index.html');
	});

	// Set GET routes for "/home" and "/index" to redirect
	server.get('/index', (connection) => {
		connection.redirect('/index.html');
	});

	// Set GET route to "/hello"
	server.get('/hello', (connection) => {
		connection.write('Hello simpleS');
		connection.end();
	});

	// Set GET route to "/json"
	server.get('/json', (connection) => {
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
		});
	});

	// Set GET route for "/upload"
	server.get('/upload', (connection) => {
		connection.drain(__dirname + '/static/upload.html');
	});

	// Set POST route for "/upload"
	server.post('/upload', (connection) => {

		// Set "text/plain" content type header
		connection.type('txt');

		// Parse received data
		connection.parse({

			limit: 1024,

			json() {
				form.on('end', () => {
					connection.send(form.result);
				}).on('error', (error) => {
					console.log(error);
				});
			},

			multipart(form) {
				form.on('field', (field) => {
					connection.write(field.name + '\n');
					field.on('readable', () => {
						connection.write((field.read() || Buffer(0)).slice(0, 32).toString() + '\n');
					}).on('end', () => {
						connection.write('----------\n');
					}).on('error', (error) => {
						console.log(error);
					});
				}).on('end', () => {
					connection.end();
				}).on('error', (error) => {
					console.log(error);
				});
			},

			plain(form) {
				form.on('readable', () => {
					connection.write((form.read() || Buffer(0)).slice(0, 32).toString('hex'));
				}).on('end', () => {
					connection.end();
				}).on('error', (error) => {
					console.log(error);
				});
			},

			urlencoded(form) {
				form.on('end', () => {
					connection.send(form.result, null, '    ');
				}).on('error', (error) => {
					console.log(error);
				});
			}
		});
	});

	// Set route to WebSocket echo example
	server.get('/ws_echo', (connection) => {
		connection.drain(__dirname + '/static/ws_echo.html');
	});

	// Set WebSocket host for "/echo"
	server.ws('/echo', {
		limit: 10
	}, (connection) => {

		connection.on('message', (message) => {
			connection.send(message.data);
		});
	});
};
