'use strict';

const tap = require('tap');

const ErrorEmitter = require('simples/lib/utils/error-emitter');
const { EventEmitter } = require('events');
const TestUtils = require('simples/test/test-utils');

tap.test('ErrorEmitter.emit()', (test) => {

	const someError = Error('Some error');

	test.test('Catch error', (t) => {

		const emitter = new EventEmitter();

		emitter.on('error', (error) => {
			t.ok(error === someError);
		});

		ErrorEmitter.emit(emitter, someError);

		t.end();
	});

	test.test('Uncaught error', (t) => {

		const emitter = new EventEmitter();

		TestUtils.mockConsoleError((errorMessage) => {
			t.equal(errorMessage, `\n${someError.stack}\n`);
		}, () => {
			ErrorEmitter.emit(emitter, someError);
		});

		t.end();
	});

	test.test('Non-TTY stderr', (t) => {

		const emitter = new EventEmitter();

		process.stderr.isTTY = false;

		ErrorEmitter.emit(emitter, someError);

		t.end();
	});

	test.end();
});