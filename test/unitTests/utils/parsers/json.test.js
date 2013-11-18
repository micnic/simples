var simpleu = require('simpleu'),
	jsonParser = require('../../../../utils/parsers/json');

simpleu({
	'true': function (test) {
		var parser = new jsonParser();
		parser.parse('true');
		parser.parse(null);
		test.deepEqual(parser.result, true);
		test.done();
	},
	'false': function (test) {
		var parser = new jsonParser();
		parser.parse('false');
		parser.parse(null);
		test.deepEqual(parser.result, false);
		test.done();
	},
	'null': function (test) {
		var parser = new jsonParser();
		parser.parse('null');
		parser.parse(null);
		test.deepEqual(parser.result, null);
		test.done();
	},
	'empty string': function (test) {
		var parser = new jsonParser();
		parser.parse('""');
		parser.parse(null);
		test.deepEqual(parser.result, '');
		test.done();
	},
	'simple string': function (test) {
		var parser = new jsonParser();
		parser.parse('"simples"');
		parser.parse(null);
		test.deepEqual(parser.result, 'simples');
		test.done();
	},
	'string with escape': function (test) {
		var parser = new jsonParser();
		parser.parse('"\\"\\u0073\\u0069\\u006D\\u0070\\u006c\\u0065\\n\\u0073\\""');
		parser.parse(null);
		test.deepEqual(parser.result, '"simple\ns"');
		test.done();
	},
	'unsigned integer': function (test) {
		var parser = new jsonParser();
		parser.parse('130590');
		parser.parse(null);
		test.deepEqual(parser.result, 130590);
		test.done();
	},
	'signed integer': function (test) {
		var parser = new jsonParser();
		parser.parse('-130590');
		parser.parse(null);
		test.deepEqual(parser.result, -130590);
		test.done();
	},
	'unsigned float < 1': function (test) {
		var parser = new jsonParser();
		parser.parse('0.130590');
		parser.parse(null);
		test.deepEqual(parser.result, 0.130590);
		test.done();
	},
	'unsigned float = 1': function (test) {
		var parser = new jsonParser();
		parser.parse('1.0');
		parser.parse(null);
		test.deepEqual(parser.result, 1.0);
		test.done();
	},
	'unsigned float > 1': function (test) {
		var parser = new jsonParser();
		parser.parse('1234.111');
		parser.parse(null);
		test.deepEqual(parser.result, 1234.111);
		test.done();
	},
	'signed float < 1': function (test) {
		var parser = new jsonParser();
		parser.parse('-0.130590');
		parser.parse(null);
		test.deepEqual(parser.result, -0.130590);
		test.done();
	},
	'signed float = 1': function (test) {
		var parser = new jsonParser();
		parser.parse('-1.0');
		parser.parse(null);
		test.deepEqual(parser.result, -1.0);
		test.done();
	},
	'signed float > 1': function (test) {
		var parser = new jsonParser();
		parser.parse('-1234.111');
		parser.parse(null);
		test.deepEqual(parser.result, -1234.111);
		test.done();
	},
	'unsigned integer with exp': function (test) {
		var parser = new jsonParser();
		parser.parse('1234e45');
		parser.parse(null);
		test.deepEqual(parser.result, 1234e45);
		test.done();
	},
	'unsigned integer with pos exp': function (test) {
		var parser = new jsonParser();
		parser.parse('1234e+45');
		parser.parse(null);
		test.deepEqual(parser.result, 1234e+45);
		test.done();
	},
	'unsigned integer with neg exp': function (test) {
		var parser = new jsonParser();
		parser.parse('1234e-45');
		parser.parse(null);
		test.deepEqual(parser.result, 1234e-45);
		test.done();
	},
	'signed integer with exp': function (test) {
		var parser = new jsonParser();
		parser.parse('-0e45');
		parser.parse(null);
		test.deepEqual(parser.result, -0e45);
		test.done();
	},
	'signed integer with pos exp': function (test) {
		var parser = new jsonParser();
		parser.parse('-1234e+45');
		parser.parse(null);
		test.deepEqual(parser.result, -1234e+45);
		test.done();
	},
	'signed integer with neg exp': function (test) {
		var parser = new jsonParser();
		parser.parse('-1234e-45');
		parser.parse(null);
		test.deepEqual(parser.result, -1234e-45);
		test.done();
	},
	'unsigned float with exp': function (test) {
		var parser = new jsonParser();
		parser.parse('1234.111e45');
		parser.parse(null);
		test.deepEqual(parser.result, 1234.111e45);
		test.done();
	},
	'unsigned float with pos exp': function (test) {
		var parser = new jsonParser();
		parser.parse('1234.111e+45');
		parser.parse(null);
		test.deepEqual(parser.result, 1234.111e+45);
		test.done();
	},
	'unsigned float with neg exp': function (test) {
		var parser = new jsonParser();
		parser.parse('1234.111e-45');
		parser.parse(null);
		test.deepEqual(parser.result, 1234.111e-45);
		test.done();
	},
	'signed float with exp': function (test) {
		var parser = new jsonParser();
		parser.parse('-0.111e45');
		parser.parse(null);
		test.deepEqual(parser.result, -0.111e45);
		test.done();
	},
	'signed float with pos exp': function (test) {
		var parser = new jsonParser();
		parser.parse('-1234.111e+45');
		parser.parse(null);
		test.deepEqual(parser.result, -1234.111e+45);
		test.done();
	},
	'signed float with neg exp': function (test) {
		var parser = new jsonParser();
		parser.parse('-1234.111e-45');
		parser.parse(null);
		test.deepEqual(parser.result, -1234.111e-45);
		test.done();
	},
	'empty array': function (test) {
		var parser = new jsonParser();
		parser.parse('[]');
		parser.parse(null);
		test.deepEqual(parser.result, []);
		test.done();
	},
	'array': function (test) {
		var parser = new jsonParser();
		parser.parse('[true, false, null, 1, -32, 32.54, 32.54e12, 32.54e-12, "simples"]');
		parser.parse(null);
		test.deepEqual(parser.result, [true, false, null, 1, -32, 32.54, 32.54e12, 32.54e-12, 'simples']);
		test.done();
	},
	'nested array': function (test) {
		var parser = new jsonParser();
		parser.parse('[[], [true], false, [null]]');
		parser.parse(null);
		test.deepEqual(parser.result, [[], [true], false, [null]]);
		test.done();
	},
	'empty object': function (test) {
		var parser = new jsonParser();
		parser.parse('{}');
		parser.parse(null);
		test.deepEqual(parser.result, {});
		test.done();
	},
	'object': function (test) {
		var parser = new jsonParser();
		parser.parse('{"a": false, "123": null}');
		parser.parse(null);
		test.deepEqual(parser.result, {'a': false, '123': null});
		test.done();
	},
	'nested object': function (test) {
		var parser = new jsonParser();
		parser.parse('{"a": {"1": "a"}, "123": {"b": {}}}');
		parser.parse(null);
		test.deepEqual(parser.result, {'a': {'1': 'a'}, '123': {'b': {}}});
		test.done();
	},
	'array object': function (test) {
		var parser = new jsonParser();
		parser.parse('["a", {"1": "a"}, "123", {"b": [1, 2, "3"]}]');
		parser.parse(null);
		test.deepEqual(parser.result, ['a', {'1': 'a'}, '123', {'b': [1, 2, '3']}]);
		test.done();
	},
	'object array': function (test) {
		var parser = new jsonParser();
		parser.parse('{"a": {"1": [1, 2, 3]}, "123": {"b": ["\\u0073\\u0069\\u006D\\u0070\\u006c\\u0065\\n\\u0073"]}}');
		parser.parse(null);
		test.deepEqual(parser.result, {'a': {'1': [1, 2, 3]}, '123': {'b':["simple\ns"]}});
		test.done();
	}
}, {});