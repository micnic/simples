# simpleS 0.1.4

simpleS is a simple http server for node.js that has some special features:

- Simple structure with minimum configuration
- Routing for http GET and POST requests, static files and errors
- WebSocket implementation (version 13, RFC 6455)
- Automatic response compression (deflate and gzip)
- Easy to use interfaces for requests and responses

Tested with node.js 0.8+

*THIS DESCRIPTION IS NOT COMPLETE, MORE CONTENT WILL BE ADDED*

### [Documentation](https://github.com/micnic/simpleS/wiki/Documentation "simpleS Documentation")

## Instalation

	npm install simples

## Usage

```javascript
var simples = require('simples');

var server = simples(12345); // Your server is set up on port 12345
```

## Routing

```javascript
server.get('/', function (request, response) {
	response.end('root');
});

server.serve('static_files'); // Route for static files located in the folder "static_files"

server.error(404, function (request, response) {
	response.end('404');
});
```

## WebSocket

```javascript
server.ws('/', {
	messageMaxLength: 1024, // The maximum size of a message
	origins: ['null'], // The accepted origins
	protocols: ['chat'] // The accepted protocols
}, function (connection) {
	console.log('New connection');

	connection.on('message', function (message) {
		console.log(message.toString());
	});

	connection.on('close', function () {
		console.log('Connection closed');
	});
});
```

On client:

```javascript
var socket = new WebSocket('ws://localhost:12345/', 'chat'); // Enjoy the real-time connection
```