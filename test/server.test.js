'use strict';

var simples = require('simples'),
	tap = require('tap');

var Server = require('simples/lib/server');

var http_localhost = 'http://localhost/',
	http_localhost_12345 = 'http://localhost:12345/',
	https_localhost = 'https://localhost/',
	https_localhost_12345 = 'https://localhost:12345/';

var clientOptions = {
	rejectUnauthorized: false
};

var defaultOptions = {
	port: 80,
	hostname: '0.0.0.0',
	backlog: 511
};

var httpsOptions = {
	https: {
		cert: __dirname + '/ssl/server-cert.pem',
		key: __dirname + '/ssl/server-key.pem'
	}
};

var shouldNotRespond = Error('Server should not respond');

var client = simples.client(clientOptions);

var head = client.head.bind(client);

var assertionsOk = function (test, assertions, value) {
	test.ok(assertions === value, 'the number of assertions is correct');
};

var serverOk = function (test, server, context) {
	test.ok(server instanceof Server, 'server is an instance of Server');
	test.ok(server === context, 'server is the callback context');
};

var testEnd = function (test, server) {
	server.stop(function () {
		test.end();
	});
};

var testFail = function (test, error, server) {
	test.fail(error.message);
	testEnd(test, server);
};

tap.ok(simples === simples.server, 'simples factory is a server factory');

tap.test('Server: no parameters', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 80', function (test) {
	simples(80).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: null options', function (test) {
	simples(null).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: default options', function (test) {
	simples(defaultOptions).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: HTTPS options', function (test) {
	simples(httpsOptions).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(https_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: callback', function (test) {

	var assertions = 0;

	simples(function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, null options', function (test) {
	simples(12345, null).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, default options', function (test) {
	simples(12345, defaultOptions).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(http_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 443, HTTPS options', function (test) {
	simples(443, httpsOptions).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(https_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, HTTPS options', function (test) {
	simples(12345, httpsOptions).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		head(https_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 80, callback', function (test) {

	var assertions = 0;

	simples(80, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, callback', function (test) {

	var assertions = 0;

	simples(12345, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: null options, callback', function (test) {

	var assertions = 0;

	simples(null, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: default options, callback', function (test) {

	var assertions = 0;

	simples(defaultOptions, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: HTTPS options, callback', function (test) {

	var assertions = 0;

	simples(httpsOptions, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(https_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, null options, callback', function (test) {

	var assertions = 0;

	simples(12345, null, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, default options, callback', function (test) {

	var assertions = 0;

	simples(12345, null, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(http_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 443, HTTPS options, callback', function (test) {

	var assertions = 0;

	simples(443, httpsOptions, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(https_localhost).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server: port 12345, HTTPS options, callback', function (test) {

	var assertions = 0;

	simples(12345, httpsOptions, function (server) {
		serverOk(test, server, this);
		assertions = 2;
	}).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		assertionsOk(test, assertions, 2);
		head(https_localhost_12345).on('error', function (error) {
			testFail(test, error, server);
		}).once('response', function () {
			testEnd(test, server);
		});
	});
});

tap.test('Server restart: no parameters', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start().once('start', function () {
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});

tap.test('Server restart: port 80', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(80).once('start', function () {
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});

tap.test('Server restart: port 12345', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(12345).once('start', function () {
			head(http_localhost).on('error', function (error) {
				head(http_localhost_12345).on('error', function (error) {
					testFail(test, error, server);
				}).once('response', function () {
					testEnd(test, server);
				});
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});

tap.test('Server restart: callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(function (server) {
			serverOk(test, server, this);
			assertions = 2;
		}).once('start', function () {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});

tap.test('Server restart: port 80, callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(80, function (server) {
			serverOk(test, server, this);
			assertions = 2;
		}).once('start', function () {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});

tap.test('Server restart: port 12345, callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(12345, function (server) {
			serverOk(test, server, this);
			assertions = 2;
		}).once('start', function () {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				head(http_localhost_12345).on('error', function (error) {
					testFail(test, error, server);
				}).once('response', function () {
					testEnd(test, server);
				});
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});

tap.test('Server stop: no parameters', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.stop().once('stop', function () {
			head(http_localhost).on('error', function () {
				testEnd(test, server);
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});

tap.test('Server stop: callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.stop(function (server) {
			serverOk(test, server, this);
			assertions = 2;
		}).once('stop', function () {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testEnd(test, server);
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});

tap.test('Server restart and stop: no parameters', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start().stop().once('start', function () {
			assertions++;
		}).once('stop', function () {
			assertions++;
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testEnd(test, server);
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});

tap.test('Server restart and stop: callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start().stop(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).once('start', function () {
			assertions++;
		}).once('stop', function () {
			assertions++;
			assertionsOk(test, assertions, 4);
			head(http_localhost).on('error', function (error) {
				testEnd(test, server);
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});

tap.test('Server stop and start: no parameters', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.stop().start().once('stop', function () {
			assertions++;
		}).once('start', function () {
			assertions++;
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});

tap.test('Server stop and start: callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.stop().start(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).once('stop', function () {
			assertions++;
		}).once('start', function () {
			assertions++;
			assertionsOk(test, assertions, 4);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});