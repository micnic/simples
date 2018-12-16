'use strict';

const fs = require('fs');
const http = require('http');

class TestUtils {

	static mockFSReadFile(error, content) {
		fs.readFile = (...args) => {
			args[1](error, content);
		};
	}

	static mockHTTPServer() {
		http.Server.prototype.close = (...args) => {
			args[0]();
		};
		http.Server.prototype.listen = (...args) => {
			args[3]();
		};
	}

	static mockSetInterval() {
		global.setInterval = (...args) => {
			args[0](...args.slice(2));

			return {
				unref() {
					return null;
				}
			};
		};
	}
}

module.exports = TestUtils;