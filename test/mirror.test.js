'use strict';

var simples = require('simples'),
	tap = require('tap');

var Mirror = require('simples/lib/mirror');

var http_localhost = 'http://localhost/',
	http_localhost_12345 = 'http://localhost:12345/',
	http_localhost_54321 = 'http://localhost:54321/',
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

var shouldNotRespond = Error('Mirror should not respond');

var head = function (location) {
	return simples.client(clientOptions).head(location);
};

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

tap.test('Mirror without parameters', function (test) {
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

tap.test('Mirror on port 80', function (test) {
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

tap.test('Mirror on port 12345', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(12345).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(http_localhost_12345).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror with default options', function (test) {
	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(defaultOptions).on('error', function (error) {
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

tap.test('Mirror with HTTPS options', function (test) {
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

tap.test('Mirror with callback', function (test) {

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

tap.test('Mirror with HTTPS options on port 443', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(443, httpsOptions).on('error', function (error) {
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

tap.test('Mirror with HTTPS options on port 12345', function (test) {
	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(12345, httpsOptions).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			head(https_localhost_12345).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror with callback on port 80', function (test) {

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

tap.test('Mirror with callback on port 12345', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(12345, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(http_localhost_12345).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror with HTTPS options and callback', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(httpsOptions, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(https_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror with all parameters on port 443', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(443, httpsOptions, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(https_localhost).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror with all parameters on port 12345', function (test) {

	var assertions = 0;

	simples().on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror(12345, httpsOptions, function (mirror) {
			mirrorOk(test, mirror, this);
			assertions = 2;
		}).on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			assertionsOk(test, assertions, 2);
			head(https_localhost_12345).on('error', function (error) {
				testFail(test, error, server, mirror);
			}).once('response', function () {
				testEnd(test, server, mirror);
			});
		});
	});
});

tap.test('Mirror restart without parameters', function (test) {
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

tap.test('Mirror restart on port 80', function (test) {
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

tap.test('Mirror restart on port 12345', function (test) {
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

tap.test('Mirror restart with callback', function (test) {

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

tap.test('Mirror restart on port 80 with callback', function (test) {

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

tap.test('Mirror restart on port 12345 with callback', function (test) {

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

tap.test('Mirror stop without parameters', function (test) {
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
					testFail(test, shouldNotRespond, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror stop with callback', function (test) {

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
					testFail(test, shouldNotRespond, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror stop and start both without parameters', function (test) {

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

tap.test('Mirror stop and start with callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop().start(function (server) {
				mirrorOk(test, server, this);
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

tap.test('Mirror stop with callback and start', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).start().once('stop', function () {
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

tap.test('Mirror stop and start both with callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.stop(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).start(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).once('stop', function () {
				assertions++;
			}).once('start', function () {
				assertions++;
				assertionsOk(test, assertions, 6);
				head(http_localhost).on('error', function (error) {
					testFail(test, error, server, mirror);
				}).once('response', function () {
					testEnd(test, server, mirror);
				});
			});
		});
	});
});
////////////////////////////////////////////////////////////////////////////////
tap.test('Mirror start and stop both without parameters', function (test) {

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
					testFail(test, shouldNotRespond, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror start and stop with callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start().stop(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).once('start', function () {
				assertions++;
			}).once('stop', function () {
				assertions++;
				assertionsOk(test, assertions, 4);
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shouldNotRespond, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror start with callback and stop', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).stop().once('start', function () {
				assertions++;
			}).once('stop', function () {
				assertions++;
				assertionsOk(test, assertions, 4);
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shouldNotRespond, server, mirror);
				});
			});
		});
	});
});

tap.test('Mirror start and stop both with callback', function (test) {

	var assertions = 0;

	simples(12345).on('error', function (error) {
		testFail(test, error, this);
	}).once('start', function (server) {
		server.mirror().on('error', function (error) {
			testFail(test, error, server, this);
		}).once('start', function (mirror) {
			mirror.start(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).stop(function (server) {
				mirrorOk(test, server, this);
				assertions += 2;
			}).once('start', function () {
				assertions++;
			}).once('stop', function () {
				assertions++;
				assertionsOk(test, assertions, 6);
				head(http_localhost).on('error', function () {
					testEnd(test, server, mirror);
				}).once('response', function () {
					testFail(test, shouldNotRespond, server, mirror);
				});
			});
		});
	});
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
					testFail(test, shouldNotRespond, server);
				});
			});
		});
	});
});