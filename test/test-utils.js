'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');

class TestUtils {

	static callAsync(fn, ...args) {
		Promise.resolve(args).then(([ ...result ]) => {
			fn(...result);
		});
	}

	static mockFSReadFile(error, content) {
		fs.readFile = (...args) => {
			TestUtils.callAsync(args[1], error, content);
		};
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

	static mockSetInterval() {
		global.setInterval = (...args) => {
			TestUtils.callAsync(args[0], ...args.slice(2));

			return {
				unref() {
					return null;
				}
			};
		};
	}
}

module.exports = TestUtils;