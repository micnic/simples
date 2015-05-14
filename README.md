<img src="https://raw.github.com/micnic/simpleS/master/logo.png"/>
# 0.7.4

[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/micnic/simpleS)

simpleS is a simple web framework for Node.JS designed to create HTTP(S) servers and clients with some special features:

- High performance and simple structure with minimum configuration
- Advanced routing for http requests, static files and errors
- Unique interface for requests and responses (named as connection)
- Response compression (deflate and gzip, disabled by default)
- Virtual Hosting
- CORS support
- Sessions (disabled by default)
- Template engine support
- WebSocket implementation (version 13, RFC 6455)
- Client API for HTTP requests and WebSocket connections
- Browser simple API for AJAX and WebSocket

#### Works with node.js 0.10+ and io.js 1.0+ !
#### Any feedback is welcome!

#### More simple modules:
- [recache](http://micnic.github.com/recache/)
- [simpleR](http://micnic.github.com/simpleR/)
- [simpleT](http://micnic.github.com/simpleT/)

### [Changelog](https://github.com/micnic/simpleS/wiki/Changelog)
### [Documentation](https://github.com/micnic/simpleS/wiki/Documentation)

## Instalation

    npm install simples

## Examples

See the folder `examples/` in the module directory, it contains examples that cover most simpleS features.

## Usage

```js
var simples = require('simples');

var server = simples(12345); // Your server is set up on port 12345
```

## Routing

```js
// Route for the server root
server.get('/', function (connection) {
    connection.end('Simples Works');
});

// Route for static files located in the folder "static_files"
server.serve('static_files');

// Route for HTTP 404 error
server.error(404, function (connection) {
    connection.end('Error 404 caught');
});
```

## Virtual Hosting

```js
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

```js
server.ws('/', {
    limit: 1024, // The maximum size of a message
    mode: 'text', // Set connection mode, see docs for more info
    origins: ['null'] // Set accepted origins
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

```js
// Use browser built-in API
var socket = new WebSocket('ws://localhost:12345/', 'echo');

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

```js
server.engine(bestTemplateEngine);
```