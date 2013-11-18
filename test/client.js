var http = require('http'),
	https = require('https');

// Make request with the provided options
function request(protocol, options, callback) {

	var body = new Buffer(0),
		options = {
			headers: options.headers || [],
			method: options.method,
			path: options.path,
            port: options.port,
            hostname: options.host
		};



	// Response end event listener
	function onEnd() {
//        console.log(body);
		callback(body.toString());
	}

	// Response readable event listener
	function onReadable() {
		body = Buffer.concat([body, this.read() || new Buffer(0)]);
	}

	// Response listener
	function onResponse(response) {
		response.on('readable', onReadable);
		response.on('end', onEnd);
	}

	// Choose the protocol
	if (protocol === 'http') {
		http.request(options, onResponse).end(options.data);
	} else if (protocol === 'https') {
		https.request(options, onResponse).end(options.data);
	}
}

exports.http = {};

exports.http.del = function () {

};

exports.http.head = function (path, content, callback) {
	request('http', {
		data: '',
		headers: content.headers,
		method: 'head',
		path: path,
        port: content.port,
        host: content.host
	}, callback);
};

exports.http.get = function (path, content, callback) {
//    console.log(content.host);
	request('http', {
		data: content.data,
		headers: content.headers,
		method: 'get',
		path: path,
        port: content.port,
        host: content.host
	}, callback);
};

exports.http.post = function () {

};

exports.http.put = function () {

};

exports.https = {};

exports.https.del = function () {

};

exports.https.head = function () {

};

exports.https.get = function () {

};

exports.https.post = function () {

};

exports.https.put = function () {

};