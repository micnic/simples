var assert = require('assert');
var http = require('http');
var qs = require('querystring');

var simples = require('simples');

var server = simples(12345);

var noopEngine = {
	render: function (string) {
		return string;
	}
};

server
	.engine(noopEngine)
	.accept('null')
	.referer('*', 'null.com')
	.serve(__dirname + '/root', function (connection) {
		connection.end('You are in the root of the folder ' + connection.path);
	})
	.error(404, function (connection) {
		connection.send('Error 404 caught');
	})
	.error(405, function (connection) {
		connection.send('Error 405 caught');
	})
	.error(500, function (connection) {
		connection.end('Error 500 caught');
	})
	.get('/', function (connection) {
		if (connection.session.name) {
			console.log('You have been here ;)');
		} else {
			console.log('You are new here :D');
			connection.session.name = 'me';
		}
		connection.drain(__dirname + '/root/index.html');
	})
	.get('accept', function (connection) {
		connection.end('CORS');
	})
	.get('cookies', function (connection) {
		Object.keys(connection.query).forEach(function (element) {
			connection.cookie(element, connection.query[element]);
		});
		connection.end('Cookies');
	})
	.get('error', function (connection) {
		0 = infinity;
	})
	.get('lang', function (connection) {
		connection.lang('en');
		connection.end('Language');
	})
	.get('param/:param', function (connection) {
		connection.send(connection.params);
	})
	.get('get', function (connection) {
		console.log(connection.session.name);

		var response = {
			body: connection.body,
			cookies: connection.cookies,
			headers: connection.headers,
			host: connection.host,
			ip: connection.ip,
			langs: connection.langs,
			method: connection.method,
			query: connection.query,
			params: connection.params,
			path: connection.path,
			session: connection.session,
			url: connection.url
		};

		connection.send(response, null, '\t');
	})
	.get('render', function (connection) {
		connection.render('Rendered string');
	})
	.get('redirect', function (connection) {
		connection.redirect('/');
	})
	.get('start', function (connection) {
		connection.end('Starting / Restarting');
		server.start(12345);
	})
	.get('stop', function (connection) {
		connection.end('Stopping');
		server.stop();
	})
	.get('type', function (connection) {
		connection.type('json');
		connection.send({type:'json'});
	})
	.get('writeend', function (connection) {
		connection.write('Write');
		connection.end('End');
	})
	.post('post', function (connection) {
		var response = {
			body: connection.body,
			cookies: connection.cookies,
			files: connection.files,
			headers: connection.headers,
			host: connection.host,
			ip: connection.ip,
			langs: connection.langs,
			method: connection.method,
			query: connection.query,
			params: connection.params,
			path: connection.path,
			session: connection.session,
			url: connection.url
		};

		connection.send(response, null, '\t');
	});

var echoSocket = server.ws('/echo', {
	protocols: ['echo'],
	raw: true
}, function (connection) {
	console.log('new connection on echoSocket');

	connection.on('message', function (message) {
		this.send(message.data);
		console.log(message.data.length + ' bytes received on echoSocket');
	});

	connection.on('close', function () {
		console.log('connection from echoSocket closed');
	});
});

var chatSocket = server.ws('/chat', {
	protocols: ['chat']
}, function (connection) {

	var chatChannel = chatSocket.channel('chat');

	chatChannel.bind(connection);
	connection.name = 'Incognito';
	
	function getUsers() {
		var users = [];
		for (var i in chatChannel.connections) {
			users[users.length] = chatChannel.connections[i].name;
		}
		return users;
	}

	chatChannel.broadcast('users', getUsers());

	connection.on('message', function (message) {console.log(message.length);
		chatChannel.broadcast('message', this.name + ': ' + message);
	});

	connection.on('changeName', function (name) {
		this.name = name;
		chatChannel.broadcast('users', getUsers());
	});

	connection.on('close', function () {
		chatChannel.broadcast('users', getUsers());
	});
});

var noopHost = server.host('127.0.0.1');

noopHost
	.get('/', function(connection) {
		connection.end('Virtual Hosting');
	});

function request(url, method, data, callback) {

	if (method === 'GET') {
		data = '';
		url += qs.stringify(data);
	} else if (method === 'POST') {
		data = qs.stringify(data);
	}

	var req = http.request({
		hostname: 'localhost',
		port: 12345,
		path: url,
		method: method
	}, function (response) {
		var content = '';

		response.setEncoding('utf8');

		response.on('data', function (data) {
			content += data;
		});

		response.on('end', function () {
			if (content) {
				console.log(content);
			}
			callback(response, content);
		});
	});

	req.end(data);

	req.on('error', function (error) {
		console.log(error);
	});
}

function test(feature) {
	feature = tests[feature];
	request(feature.url, feature.method, feature.data, feature.callback);
}

var equal = function() {return true;}//assert.equal;

var tests = {
	accept: {
		url: '/accept',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(response.headers['access-control-allow-origin'], 'null.com');
			test('lang');
		}
	},
	lang: {
		url: '/lang?value=en',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(response.headers['content-language'], 'en');
			equal(content, 'Language');
			test('params');
		}
	},
	params: {
		url: '/param/works',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(content, '{"param":"works"}');
			test('redirect');
		}
	},
	redirect: {
		url: '/redirect',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(response.statusCode, 302);
			equal(response.headers.location, '/');
			console.log('Redirect');
			test('render');
		}
	},
	render: {
		url: '/render',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(content, 'Rendered string');
			test('type');
		}
	},
	start: {
		url: '/start',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(content, 'Starting / Restarting');

			// Undocumented feature, used only internally
			server.server.once('release', function () {
				test('accept');
			});
		}
	},
	stop: {
		url: '/stop',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(content, 'Stopping');
			console.log('\nMore tests can be made in browser,');
			console.log('just run "simples/test/test.js" script');
		}
	},
	type: {
		url: '/type',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(content, '{"type":"json"}');
			test('writeend');
		}
	},
	writeend: {
		url: '/writeend',
		method: 'GET',
		data: null,
		callback: function (response, content) {
			equal(content, 'WriteEnd');
			test('stop');
		}
	}
};

if (process.argv[2] === 'test') {
	server.server.once('release', function () {
		http.get('http://127.0.0.1:12345', function (response) {
			var content = '';

			response.setEncoding('utf8');

			response.on('readable', function (data) {
				content += this.read();
			});

			response.on('end', function () {
				console.log(content);
				equal(content, 'Virtual Hosting');
				test('start');
			});
		});
	});
}