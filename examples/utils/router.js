module.exports = function (server) {
	server.serve(__dirname + '/../static').get('/', function (connection) {
		connection.header('Test-Header', 'Test-Value');
		connection.lang('en');
		connection.write('<!doctype html>');
		connection.write('<html>');
		connection.write('<head>');
		connection.write('</head>');
		connection.write('<body>');
		connection.write('<img src="/img/simples.png"><br>');
		connection.write('<a href="/json">json</a><br>');
		connection.write('<a href="/ws">ws</a>');
		connection.write('</body>');
		connection.end('</html>');
	}).get('/json', function (connection) {
		connection.type('json');
		connection.send({
			body: connection.body,
			cookies: connection.cookies,
			headers: connection.headers,
			host: connection.host,
			ip: connection.ip,
			langs: connection.langs,
			method: connection.method,
			params: connection.params,
			path: connection.path,
			query: connection.query,
			session: connection.session,
			url: connection.url
		}, null, '\t');
	}).get('/ws', function (connection) {
		connection.drain(__dirname + '/../static/ws.html');
	}).ws('/echo', {
		rawMode: true
	}, function (connection) {
		connection.on('message', function (message) {
			connection.send(message.data);
		});
	});
}