'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');

class TestUtils {

	static callAsync(fn, ...args) {
		Promise.resolve(args).then(([ ...result ]) => {
			fn(...result);
		});
	}

	static mock(object, method, mock, callback) {

		const objectMethod = object[method];

		const restore = () => {
			object[method] = objectMethod;
		};

		object[method] = mock;

		if (callback.length) {
			callback(restore);
		} else {
			callback();
			restore();
		}
	}

	static mockBufferAllocUnsafe(callback) {

		const mock = (size) => Buffer.alloc(size);

		TestUtils.mock(Buffer, 'allocUnsafe', mock, callback);
	}

	static mockCryptoRandomBytes(error,	buffer, callback) {

		const mock = (...args) => {
			TestUtils.callAsync(args[1], error, buffer);
		};

		TestUtils.mock(crypto, 'randomBytes', mock, callback);
	}

	static mockProcessSTDERRWrite(mock, callback) {
		TestUtils.mock(process.stderr, 'write', mock, callback);
	}

	static mockFSReadFile(error, content, callback) {

		const mock = (...args) => {
			TestUtils.callAsync(args[1], error, content);
		};

		TestUtils.mock(fs, 'readFile', mock, callback);
	}

	static mockHTTPServer() {
		http.Server.prototype.close = (...args) => {
			TestUtils.callAsync(args[0]);
		};
		http.Server.prototype.listen = (...args) => {
			TestUtils.callAsync(args[3]);
		};
		https.Server.prototype.close = (...args) => {
			TestUtils.callAsync(args[0]);
		};
		https.Server.prototype.listen = (...args) => {
			TestUtils.callAsync(args[3]);
		};
	}
}

module.exports = TestUtils;