var fs = require('fs');
var http = require('http');
var path = require('path');
var stream = require('stream');
var url = require('url');
var zlib = require('zlib');

var mime = require('./mime.js');

var server = http.createServer(handle);
server.wsHosts = {};
server.notFound = function (request, response) {
	response.end('"' + request.url.href + '" was not found');
};
server.GETroutes = {};
server.POSTroutes = {};
server.ALLroutes = {};

function handle(request, response) {
	
	// Redirect response for future compression
	var responseStream = response;

	// Check for supported content encodings of the client
	var acceptEncoding = request.headers['accept-encoding'];
	if (acceptEncoding) {
		var contentEncoding;
		if (acceptEncoding.indexOf('deflate') >= 0) {
			contentEncoding = 'deflate';
		} else if (acceptEncoding.indexOf('gzip') >= 0) {
			contentEncoding = 'gzip';
		}
	}

	// Check for encoding for the response
	if (contentEncoding) {
		
		// Initialize compression stream and its content
		var compressStream = new stream();
		var paused = true;
		var processed = false;
		var resultContent = Buffer(0);

		// Compress stream is a readable and writable stream
		compressStream.readable = true;
		compressStream.writable = true;

		// Prepare the pipe for compression
		responseStream = compressStream;
		responseStream.pipe(response);

		// Set content encoding
		response.setHeader('Content-Encoding', contentEncoding);

		// End to add data to the content
		compressStream.end = function (data) {
			if (data) {
				this.write(data);
			}
			this.writable = false;
			processStream();
		}

		// Stops for a while the reading of the compression content
		compressStream.pause = function () {
			paused = true;
		}

		// Resume the reading of compression content
		compressStream.resume = function () {
			if (paused) {
				paused = false;
				read();
			}
		}

		// Add data to the content
		compressStream.write = function (data) {
			if (!this.writable) {
				return;
			}
			data = Buffer('' + data);
			resultContent = Buffer.concat([resultContent, data]);
			return true;
		}

		// Compress content with specific encoding
		function processStream() {
			zlib[contentEncoding](resultContent, function (error, result) {
				resultContent = result;
				processed = true;
				compressStream.resume();
			});
		}

		// Read and fragment compressed content
		function read() {

			// Check if the stream has content, is readable and not paused
			if (resultContent.length === 0 && paused && !compressStream.readable) {
				return;
			}

			// Get next 64 bytes to read
			var readData;
			if (resultContent.length > 65536) {
				readData = resultContent.slice(0, 65536);
				resultContent = resultContent.slice(65536);
			} else {
				readData = resultContent;
				resultContent = Buffer(0);
			}

			// Emit data and wait for next loop to read data
			compressStream.emit('data', readData);
			process.nextTick(read);

			// Stop stream if there is nothing to read and the content is processed
			if (resultContent.length === 0 && processed) {
				compressStream.readable = false;
				compressStream.emit('end');
			}
		}
	}
	
	// The request interface available in callbacks
	var requestInterface = {

		// Data about the client remote connection
		connection: {
			ip: request.connection.remoteAddress,
			port: request.connection.remotePort
		},

		// The cookies provided by the client
		get cookies() {
			if (request.headers['cookie']) {
				return request.headers['cookie'].split(/;\s*/).map(function (element) {
					var eq = element.indexOf('=');
					return {
						name: element.slice(0, eq).trim(),
						value: element.slice(eq + 1).trim()
					}
				});
			}
			return [];
		},

		// The headers of the request
		headers: request.headers,

		// The languages accepted by the client
		get langs() {
			if (request.headers['accept-language']) {
				return request.headers['accept-language'].split(/\s*,\s*/).map(function (element) {
					var value = element.split(/\s*;\s*/);
					return {
						lang: value[0],
						quality: value[1] ? Number(value[1].split(/\s*=\s*/)[1]) : 1
					}
				}).sort(function (first, second) {
					return second.quality - first.quality;
				}).map(function (element) {
					return element.lang;
				});
			}
			return [];
		},

		// The method of the request
		method: request.method,

		// The components of the request url
		url: url.parse(request.url, true)
	};

	// The response interface available in callbacks
	var typeSet = false;
	var responseInterface = {

		// Set the cookie with specific options (expires, max-age, path, domain, secure, httponly)
		cookie: function (name, value, config) {
			var cookie = name + '=' + value;

			if (config) {
				if (config.expires) {
					cookie += ';expires=' + new Date(config.expires).toUTCString();
				}

				if (config.maxAge) {
					cookie += ';max-age=' + config.maxAge;
				}

				if (config.path) {
					cookie += ';path=' + config.path;
				} else {
					cookie += ';path=' + '/';
				}

				if (config.domain) {
					cookie += ';domain=' + config.domain;
				} else {
					cookie += ';domain=' + request.headers['host'];
				}

				if (config.secure) {
					cookie += ';secure';
				}

				if (config.httpOnly) {
					cookie += ';httponly';
				}
			}

			if (response.getHeader('Set-Cookie')) {
				response.setHeader('Set-Cookie', response.getHeader('Set-Cookie') + '\r' + cookie);
			} else {
				response.setHeader('Set-Cookie', cookie);
			}
		},

		// Force to download the file
		download: function (filename) {
			response.setHeader('Content-Disposition', 'attachment;filename=' + '"' + filename + '"');
			response.end();
		},

		// End response stream
		end: function (data) {
			if (data) {
				this.write(data);
			}
			responseStream.end();
		},

		// Set the language of the content of the response
		lang: function (lang) {
			response.setHeader('Content-Language', lang);
		},

		// Redirect the client
		redirect: function (path) {
			response.writeHead(302, {
				'Location':	path
			});
			response.end();
		},

		// Set cookie expiration time in past
		removeCookie: function (name) {
			this.cookie(name, '', {expires: new Date().toUTCString()});
		},

		// Set the type of the content of the response
		type: function (type) {
			typeSet = true;
			response.setHeader('Content-Type', mime(type));
		},

		// Write to response stream
		write: function (data) {
			if (!typeSet) {
				typeSet = true;
				response.setHeader('Content-Type', 'text/html;charset=utf-8');
			}
			responseStream.write(data);
		}
	};

	// Routing requests
	var requestURL = url.parse(request.url).pathname;
	if (request.method === 'GET') {
		if (server.GETroutes[requestURL]) {
			server.GETroutes[requestURL](requestInterface, responseInterface);
		} else if (server.ALLroutes[requestURL]) {
			server.ALLroutes[requestURL](requestInterface, responseInterface);
		} else if (server.staticRoute) {

			// Routing static files
			var realPath = path.join(server.staticRoute, requestURL);
			fs.stat(realPath, function (error, stats) {
				if (!error && stats.isFile()) {
					var lastModified = new Date(stats.mtime).valueOf();
					if (Number(request.headers['if-modified-since']) === lastModified) {
						response.statusCode = 304;
						response.end();
					} else {
						response.writeHead(200, {
							'Content-Type': mime(path.extname(realPath).slice(1)),
							'Last-Modified': lastModified
						});
						fs.createReadStream(realPath).pipe(responseStream);
					}
				} else {
					response.statusCode = 404;
					server.notFound(requestInterface, responseInterface);
				}
			});
		} else {
			response.statusCode = 404;
			server.notFound(requestInterface, responseInterface);
		}
	} else if (request.method === 'POST') {
		if (server.POSTroutes[requestURL]) {
			server.POSTroutes[requestURL](requestInterface, responseInterface);
		} else if (server.ALLroutes[requestURL]) {
			server.ALLroutes[requestURL](requestInterface, responseInterface);
		} else {
			response.statusCode = 404;
			server.notFound(requestInterface, responseInterface);
		}
	}
}

module.exports = server;