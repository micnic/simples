<img src="https://raw.github.com/micnic/simpleS/master/logo.png"/>
# 0.5.3

simpleS is a simple HTTP(S) server for Node.JS that has some special features:

- Simple structure with minimum configuration
- No dependencies and high performance
- Advanced routing for http requests, static files and errors
- Restful verbs
- Unique interface for requests and responses
- Response compression (deflate and gzip)
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
- [simpleU](http://micnic.github.com/simpleU/)

### [Changelog](https://github.com/micnic/simpleS/wiki/Changelog)
### [Documentation](https://github.com/micnic/simpleS/wiki/Documentation)

## Instalation

    npm install simples

## Examples

See the folder `examples/` in the module directory, it contains examples that cover most simpleS features.

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
    limit: 1024, // The maximum size of a message
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