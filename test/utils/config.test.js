'use strict';

const tap = require('tap');

const Config = require('simples/lib/utils/config');

tap.test('Config.getEnableOption()', (test) => {

	const enableFunction = () => true;

	test.ok(Config.getEnableOption() === false);
	test.ok(Config.getEnableOption(false) === false);
	test.ok(Config.getEnableOption(true) === true);
	test.ok(Config.getEnableOption(enableFunction) === enableFunction);

	test.end();
});

tap.test('Config.getObjectOption()', (test) => {

	const emptyOption = {};
	const defaultOption = Object;

	test.ok(Config.getObjectOption(emptyOption, defaultOption) === emptyOption);
	test.ok(Config.getObjectOption(undefined, defaultOption) instanceof defaultOption);
	test.ok(Config.getObjectOption() === null);

	test.end();
});

tap.test('Config.getSetOption()', (test) => {

	const availableCompressions = new Set(['deflate', 'gzip']);
	const defaultCompression = 'deflate';

	test.ok(Config.getSetOption('gzip', availableCompressions, defaultCompression) === 'gzip');
	test.ok(Config.getSetOption('invalid-compression', availableCompressions, defaultCompression) === 'deflate');

	test.end();
});

tap.test('Config.getBooleanOption()', (test) => {

	test.ok(Config.getBooleanOption() === false);
	test.ok(Config.getBooleanOption(false) === false);
	test.ok(Config.getBooleanOption(true) === true);

	test.end();
});

tap.test('Config.getArrayOption()', (test) => {

	const emptyOption = [];
	const defaultOption = [];

	test.ok(Config.getArrayOption(emptyOption, defaultOption) === emptyOption);
	test.ok(Config.getArrayOption(null, defaultOption) === defaultOption);

	test.end();
});

tap.test('Config.getStringOption()', (test) => {

	test.ok(Config.getStringOption() === '');
	test.ok(Config.getStringOption('string') === 'string');

	test.end();
});

tap.test('Config.getFunctionOption()', (test) => {

	const functionOption = () => true;

	test.ok(Config.getFunctionOption() === null);
	test.ok(Config.getFunctionOption(functionOption) === functionOption);

	test.end();
});

tap.test('Config.getNumberOption()', (test) => {

	test.ok(Config.getNumberOption(undefined, 1) === 1);
	test.ok(Config.getNumberOption(2, 1) === 2);

	test.end();
});

tap.test('Config.getConfig()', (test) => {

	const config = Config.getConfig({
		array: {
			default: [],
			type: 'array'
		},
		boolean: {
			type: 'boolean'
		},
		enable: {
			type: 'enable'
		},
		function: {
			type: 'function'
		},
		number: {
			default: 0,
			type: 'number'
		},
		object: {
			default: Object,
			type: 'object'
		},
		set: {
			default: 'head',
			set: new Set(['head', 'tail']),
			type: 'set'
		},
		string: {
			type: 'string'
		}
	}, {});

	test.match(config, {
		array: [],
		boolean: false,
		enable: false,
		function: null,
		number: 0,
		object: {},
		set: 'head',
		string: ''
	});

	test.end();
});

tap.test('Config.isEnabled()', (test) => {

	test.equal(Config.isEnabled(() => true, null), true);
	test.equal(Config.isEnabled(() => false, null), false);
	test.equal(Config.isEnabled(true, null), true);
	test.equal(Config.isEnabled(false, null), false);

	test.end();
});

tap.test('Config.setConfig()', (test) => {

	const schema = {
		data: {
			type: Config.types.boolean
		}
	};

	const destination = {
		data: false
	};

	Config.setConfig(schema, destination);

	test.equal(destination.data, false);

	Config.setConfig(schema, destination, {
		data: true,
		inexistent: true
	});

	test.equal(destination.data, true);
	test.equal(Object.keys(destination).length, 1);

	test.end();
});