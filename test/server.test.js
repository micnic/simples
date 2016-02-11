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

var head = function (location) {
	return simples.client(clientOptions).head(location);
};

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

tap.test('Server without parameters', function (test) {
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

tap.test('Server on port 80', function (test) {
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

tap.test('Server on port 12345', function (test) {
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

tap.test('Server with default options', function (test) {
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

tap.test('Server with HTTPS options', function (test) {
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

tap.test('Server with callback', function (test) {

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

tap.test('Server with HTTPS options on port 443', function (test) {
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

tap.test('Server with HTTPS options on port 12345', function (test) {
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

tap.test('Server with callback on port 80', function (test) {

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

tap.test('Server with callback on port 12345', function (test) {

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

tap.test('Server with HTTPS options and callback', function (test) {

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

tap.test('Server with all parameters on port 443', function (test) {

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

tap.test('Server with all parameters on port 12345', function (test) {

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

tap.test('Server restart without parameters', function (test) {
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

tap.test('Server restart on port 80', function (test) {
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

tap.test('Server restart on port 12345', function (test) {
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

tap.test('Server restart with callback', function (test) {

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

tap.test('Server restart on port 80 with callback', function (test) {

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

tap.test('Server restart on port 12345 with callback', function (test) {

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

tap.test('Server stop without parameters', function (test) {
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

tap.test('Server stop with callback', function (test) {

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

tap.test('Server stop and start both without parameters', function (test) {

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

tap.test('Server stop and start with callback', function (test) {

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

tap.test('Server stop with callback and start', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.stop(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).start().once('stop', function () {
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

tap.test('Server stop and start both with callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.stop(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).start(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).once('stop', function () {
			assertions++;
		}).once('start', function () {
			assertions++;
			assertionsOk(test, assertions, 6);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server);
			}).once('response', function () {
				testEnd(test, server);
			});
		});
	});
});

tap.test('Server start and stop both without parameters', function (test) {

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

tap.test('Server start and stop with callback', function (test) {

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

tap.test('Server start with callback and stop', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).stop().once('start', function () {
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

tap.test('Server start and stop both with callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.start(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).stop(function (server) {
			serverOk(test, server, this);
			assertions += 2;
		}).once('start', function () {
			assertions++;
		}).once('stop', function () {
			assertions++;
			assertionsOk(test, assertions, 6);
			head(http_localhost).on('error', function (error) {
				testEnd(test, server);
			}).once('response', function () {
				testFail(test, shouldNotRespond, server);
			});
		});
	});
});