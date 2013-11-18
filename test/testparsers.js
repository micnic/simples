var stream = require('stream')
var request = new stream.Readable();

/*
	application/x-www-form-urlencoded

	'a=1&b=2&c=3'


	multipart/form-data; boundary=AaB03x

	[
		'--AaB03x',
		'content-disposition: form-data; name="field1"',
		'',
		'$field1',
		'--AaB03x',
		'content-disposition: form-data; name="field2"',
		'',
		'$field2',
		'--AaB03x',
		'content-disposition: form-data; name="userfile"; filename="$filename"',
		'Content-Type: $mimetype',
		'Content-Transfer-Encoding: binary',
		'',
		'$binarydata',
		'--AaB03x--',
		''
	].join('\r\n')


	application/json
	'[[["\\"\u0061\u0062\u0063\\"", -1.2e3, false, null, true]]]'
*/

var json = '12345';

var jsonParser = require('../utils/parsers/json');

var start;
start = process.hrtime();
var parser = new jsonParser();
parser.parse(json);
parser.parse(null);
console.log(process.hrtime(start)[1]);
console.log(JSON.stringify(parser.result) === json);

/*start = process.hrtime();
JSON.parse(json);
console.log(process.hrtime(start)[1], process.memoryUsage());*/

/*var data = [json];
var parsers = require('../utils/parsers');

request.headers = {
	'content-type': 'application/json'
};

request._read = function () {
	if (data.length) {
		this.push(data.shift());
	} else {
		this.push(null);
	}
};

var connection = {
	body: {},
	request: request
};

parsers.parse(connection);

request.on('end', function () {
	//console.log(connection.body);
	console.log(JSON.stringify(connection.body) === json);
});*/