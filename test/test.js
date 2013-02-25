var assert = require('assert');
var fs = require('fs');
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
	.engine(noopEngine, 'render')
	.accept('*')
	.referer('*', 'null.com')
	.serve(__dirname + '/root', function (request, response) {
		response.end('You are in the root of the folder ' + request.url.path);
	})
	.error(404, function (request, response) {
		response.send('Error 404 caught');
	})
	.error(405, function (request, response) {
		response.send('Error 405 caught');
	})
	.error(500, function (request, response) {
		response.end();
		0 = infinity;
	})
	.get('/', function (request, response) {
		if (request.session.name) {
			console.log('You have been here ;)');
		} else {
			console.log('You are new here :D');
			request.session.name = 'me';
		}
		response.drain(__dirname + '/root/index.html');
	})
	.get('/accept', function (request, response) {
		response.end('CORS');
	})
	.get('/cookies', function (request, response) {
		Object.keys(request.query).forEach(function (element) {
			response.cookie(element, request.query[element]);
		});
		response.end('Cookies');
	})
	.get('/error', function (request, response) {
		0 = infinity;
	})
	.get('/lang', function (request, response) {
		response.lang('en');
		response.end('Language');
	})
	.get('/get', function (request, response) {
		console.log(request.session.name);
		response.write('body: ' + request.body + '\n');
		response.write('cookies: ' + JSON.stringify(request.cookies) + '\n');
		response.write('headers: ' + JSON.stringify(request.headers) + '\n');
		response.write('langs: ' + JSON.stringify(request.langs) + '\n');
		response.write('method: ' + request.method + '\n');
		response.write('query: ' + JSON.stringify(request.query) + '\n');
		response.write('url: ' + JSON.stringify(request.url) + '\n');
		response.end();
	})
	.get('/render', function (request, response) {
		response.render('Rendered string');
	})
	.get('/redirect', function (request, response) {
		response.redirect('/');
	})
	.get('/start', function (request, response) {
		response.end('Starting / Restarting');
		server.start(12345);
	})
	.get('/stop', function (request, response) {
		response.end('Stopping');
		server.stop();
	})
	.get('/type', function (request, response) {
		response.type('json');
		response.send({type:'json'});
	})
	.get('/writeend', function (request, response) {
		response.write('Write');
		response.end('End');
	})
	.post('/post', function (request, response) {
		response.write('body: ' + request.body + '\n');
		response.write('cookies: ' + JSON.stringify(request.cookies) + '\n');
		response.write('files: ' + JSON.stringify(request.files) + '\n');
		response.write('headers: ' + JSON.stringify(request.headers) + '\n');
		response.write('langs: ' + JSON.stringify(request.langs) + '\n');
		response.write('method: ' + request.method + '\n');
		response.write('query: ' + JSON.stringify(request.query) + '\n');
		response.write('url: ' + JSON.stringify(request.url) + '\n');
		response.end();
	});

var echoSocket = server.ws('/echo', {
	protocols: ['echo'],
	raw: true
}, function (connection) {

	connection.on('message', function (message) {
		this.send(message.data);
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

	connection.on('message', function (message) {
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
	.get('/', function(request, response) {
		response.end('Virtual Hosting');
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
		method: method,
		headers: {
			origin: 'null.com'
		}
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

var equal = assert.equal;

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
			console.log('\nMore tests can be made in browser,\njust run simples/test/test.js script');
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

			response.on('data', function (data) {
				content += data;
			});

			response.on('end', function () {
				console.log(content);
				equal(content, 'Virtual Hosting');
				test('start');
			});
		});
	});
}