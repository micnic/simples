'use strict';

var simples = require('simples'),
	tap = require('tap');

var Mirror = require('simples/lib/mirror');

var http_localhost = 'http://localhost/',
	http_localhost_12345 = 'http://localhost:12345/',
	https_localhost = 'https://localhost/';

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
		key: __dirname + '/ssl/server-key.pem',
		handshakeTimeout: 60
	}
};

var inexistentSslCert = {
	port: 443,
	https: {
		cert: __dirname + '/inexistent.pem'
	}
};

var shoudlNotHappen = Error('This should not happen');

var client = simples.client(clientOptions);

var head = client.head.bind(client);

var assertionsOk = function (test, assertions, value) {
	test.ok(assertions === value, 'the number of assertions is correct');
};

var mirrorOk = function (test, mirror, context) {
	test.ok(mirror instanceof Mirror, 'mirror is an instance of Mirror');
	test.ok(mirror === context, 'mirror is the callback context');
};

var responseOk = function (test, response, body) {
	test.ok(response.statusCode === 200, 'Mirror response status code is 200');
	test.ok(body.toString() === 'simpleS', 'Mirror response body is "simpleS"');
};

var testEnd = function (test, server, mirror) {
	server.stop(function () {
		if (mirror) {
			mirror.stop(function () {
				test.end();
			});
		} else {
			test.end();
		}
	});
};

var testFail = function (test, error, server, mirror) {
	test.fail(error.message);
	testEnd(test, server, mirror);
};

tap.test('Mirror: no parameters', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: port 80', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(80).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: null options', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(null).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: HTTPS options', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(httpsOptions).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(https_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: inexistent SSL certificate', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(inexistentSslCert).on('error', function () {
			testEnd(test, server);
		}).once('start', function (mirror) {
			testFail(test, shoudlNotHappen, server);
		});
	});
});

tap.test('Mirror: callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: port 80, null options', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(80, null).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: port 80, callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(80, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: null options, callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(null, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror: port 80, default options, callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(80, defaultOptions, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(http_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror restart: no parameters', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start().once('start', function () {
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart: same port', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(80).once('start', function () {
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart: different 12345', function (test) {
	simples(54321).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(12345).once('start', function () {
				head(http_localhost_12345).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart: callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(function (mirror) {
				mirrorOk(test, mirror, this);
				assertions = 2;
			}).once('start', function () {
				assertionsOk(test, assertions, 2);
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart: same port, callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(80, function (mirror) {
				mirrorOk(test, mirror, this);
				assertions = 2;
			}).once('start', function () {
				assertionsOk(test, assertions, 2);
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart: different port, callback', function (test) {

	var assertions = 0;

	simples(54321).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(12345, function (mirror) {
				mirrorOk(test, mirror, this);
				assertions = 2;
			}).once('start', function () {
				assertionsOk(test, assertions, 2);
				head(http_localhost_12345).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror stop: no parameters', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop().once('stop', function () {
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shoudlNotHappen, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror stop: callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop(function () {
				mirrorOk(test, mirror, this);
				assertions = 2;
			}).once('stop', function () {
				assertionsOk(test, assertions, 2);
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shoudlNotHappen, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart and stop: no parameters', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start().stop().once('start', function () {
				assertions++;
			}).once('stop', function () {
				assertions++;
				assertionsOk(test, assertions, 2);
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shoudlNotHappen, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror restart and stop: callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start().stop(function (mirror) {
				mirrorOk(test, mirror, this);
				assertions += 2;
			}).once('start', function () {
				assertions++;
			}).once('stop', function () {
				assertions++;
				assertionsOk(test, assertions, 4);
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shoudlNotHappen, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror stop and start: no parameters', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop().start().once('stop', function () {
				assertions++;
			}).once('start', function () {
				assertions++;
				assertionsOk(test, assertions, 2);
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror stop and start: callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop().start(function (mirror) {
				mirrorOk(test, mirror, this);
				assertions += 2;
			}).once('stop', function () {
				assertions++;
			}).once('start', function () {
				assertions++;
				assertionsOk(test, assertions, 4);
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});

tap.test('Get existing mirror: no parameters', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			test.ok(mirror === server.mirror(), 'mirror is valid');
			testEnd(test, server, mirror);
		});
	})
});

tap.test('Get existing mirror: port provided', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			test.ok(mirror === server.mirror(80), 'mirror is valid');
			testEnd(test, server, mirror);
		});
	})
});

tap.test('Mirror destroy', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.destroy(function () {
				head(http_localhost).on('error', function () {
					testEnd(test, server);
				}).once('response', function () {
					testFail(test, shoudlNotHappen, server);
				});
			});
		});
	});
});

tap.test('Start destroyed mirror', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.destroy(function () {
				mirror.start(function () {
					testFail(test, shoudlNotHappen, server, mirror);
				});
				testEnd(test, server);
			});
		});
	});
});

tap.test('Stop destroyed mirror', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.destroy(function () {
				mirror.stop(function () {
					testFail(test, shoudlNotHappen, server, mirror);
				});
				testEnd(test, server);
			});
		});
	});
});