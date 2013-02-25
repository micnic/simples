# simpleS 0.3.4

simpleS is a simple HTTP(S) server for Node.JS that has some special features:

- Simple structure with minimum configuration
- Routing for http GET and POST requests, static files and errors
- Dynamic caching for static files
- Virtual Hosting
- WebSocket implementation (version 13, RFC 6455)
- CORS support and Referer blocking
- Sessions
- Template engine connection
- Automatic response compression (deflate and gzip)
- Easy to use interfaces for requests and responses
- Client-side simple API for AJAX and WebSocket

Tested with node.js 0.8+

*THIS DESCRIPTION IS NOT COMPLETE, MORE CONTENT WILL BE ADDED*

### [Documentation](https://github.com/micnic/simpleS/wiki/Documentation "simpleS Documentation")

#### More simple modules
[simpleT](http://micnic.github.com/simpleT/)

## Instalation

	npm install simples

## Testing

	npm test simples

## Start Demo Server

	npm start simples

Then try [http://localhost:12345](http://localhost:12345) in your browser

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

## Virtual Hosting

```javascript
var mainHost = server; // Main host
var host1 = server.host('example.com'); // Other hosts
var host2 = server.host('example2.com');

// Now for each host you can apply individual routing
mainHost.get('/', function (request, response) {
	response.end('Main Host');
});

host1.get('/', function (request, response) {
	response.end('Host1');
});

host2.get('/', function (request, response) {
	response.end('Host2');
});
```

## WebSocket

```javascript
server.ws('/', {
	length: 1024, // The maximum size of a message
	protocols: ['echo'] // The accepted protocols
}, function (connection) {
	console.log('New connection');

	connection.on('message', function (message) {
		message = message.toString();
		console.log(message);
		connection.send(message);
	});

	connection.on('close', function () {
		console.log('Connection closed');
	});
});
```

On client:

```javascript
var socket = new WebSocket('ws://localhost:12345/', 'echo'); // Enjoy the real-time connection

socket.onmessage = function (event) {
	console.log(event.data);
};

socket.send('ECHO');
```