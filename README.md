# simpleS 0.3.8

simpleS is a simple HTTP(S) server for Node.JS that has some special features:

- Simple structure with minimum configuration
- Advanced routing for http GET and POST requests, static files and errors
- Automatic response compression (deflate and gzip)
- Easy to use interfaces for requests and responses
- Virtual Hosting
- CORS support and Referer blocking
- Sessions
- Template engine connection
- WebSocket implementation (version 13, RFC 6455)
- Client-side simple API for AJAX and WebSocket

#### Works in Node.JS 0.10+
#### Any feedback is welcome!

#### More simple modules:
- [simpleR](http://micnic.github.com/simpleR/)
- [simpleT](http://micnic.github.com/simpleT/)

## [Documentation](https://github.com/micnic/simpleS/wiki/Documentation "simpleS Documentation")
Read it, it contains all the information in a very handy way

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
server.get('/', function (connection) {
	connection.end('root');
});

server.serve('static_files'); // Route for static files located in the folder "static_files"

server.error(404, function (connection) {
	connection.end('404');
});
```

## Virtual Hosting

```javascript
var mainHost = server; // Main host
var host1 = server.host('example.com'); // Other hosts
var host2 = server.host('example2.com');

// Now for each host you can apply individual routing
mainHost.get('/', function (connection) {
	connection.end('Main Host');
});

host1.get('/', function (connection) {
	connection.end('Host1');
});

host2.get('/', function (connection) {
	connection.end('Host2');
});
```

## WebSocket

```javascript
server.ws('/', {
	length: 1024, // The maximum size of a message
	protocols: ['echo'], // The accepted protocols
	raw: true // Connections in raw mode, see docs for more info
}, function (connection) {
	console.log('New connection');

	connection.on('message', function (message) {
		console.log('Message: ' + message.data);
		connection.send(message.data);
	});

	connection.on('close', function () {
		console.log('Connection closed');
	});
});
```

On client:

```javascript
// Use browser built-in API
var socket = new WebSocket('ws://localhost:12345/', 'echo'); // Enjoy the real-time connection

socket.onmessage = function (event) {
	console.log(event.data);
};

socket.send('ECHO');

// or simpleS client-side simple API
var socket = simples.ws('/', ['echo']);

socket.on('message', function (message) {
	console.log(message.data);
});

socket.send('ECHO');
```

## Template engine connection

```javascript
server.engine(bestTemplateEngine);
```