<img src="https://raw.github.com/micnic/simpleS/master/logo.png"/>

# 0.8.8

[![Gitter](https://badges.gitter.im/simples.png)](https://gitter.im/micnic/simpleS)

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
- [recache](https://www.npmjs.com/package/recache)
- [simpleR](https://www.npmjs.com/package/simpler)
- [simpleT](https://www.npmjs.com/package/simplet)

### [Changelog](https://github.com/micnic/simpleS/wiki/Changelog)
### [Documentation](https://github.com/micnic/simpleS/wiki/Documentation)

## Instalation

    npm install simples

## Examples

See the folder `examples/` in the module directory, it contains examples that cover most simpleS features.

## Usage

### Server Creation

```js
var simples = require('simples');

var server = simples(); // Your server is set up on port 80

// Enable compression (default is deflate)
server.config({
    compression: {
        enabled: true
    }
});

// Serve static files located in the folder "static"
server.serve('static');

// Catch 404 Error
server.error(404, function (connection) {
    connection.end('Error 404 caught');
});

// Create the first route
server.get('/', function (connection) {
    connection.end('Simples Works');
});
```

### Client Creation

```js
var simples = require('simples');

var client = simples.client();

// GET request
client.get('/').on('body', function (response, body) {
    console.log('Response status: ' + response.status);
    console.log('Response body: ' + body.toString());
});

// POST request
client.post('/send').send(/* data */).on('response', function (response) {
    // Do something with the response
}).on('body', function (response, body) {
    console.log('Response body: ' + body.toString());
});
```

### Virtual Hosting

```js
var host0 = server; // The server is in the same time the main host
var host1 = server.host('example.com'); // Other hosts
var host2 = server.host('example2.com');

// Now for each host you can apply individual routing
host0.get('/', function (connection) {
    connection.end('Main Host');
});

host1.get('/', function (connection) {
    connection.end('Host 1');
});

host2.get('/', function (connection) {
    connection.end('Host 2');
});
```

### WebSocket

Let's create an echo WebSocket server:

```js
server.ws('/', {
    limit: 1024, // The maximum size of a message
    mode: 'text', // Set connection mode, see docs for more info
    origins: ['null'] // Set accepted origins, "null" for localhost
}, function (connection) {

    // Log the new connection
    console.log('New connection');

    // Listen for messages to send them back
    connection.on('message', function (message) {
        console.log('Message: ' + message.data);
        connection.send(message.data);
    });

    // Log connection close
    connection.on('close', function () {
        console.log('Connection closed');
    });
});
```

Access the server from the browser built-in WebSocket API:

```js
var socket = new WebSocket('ws://localhost/', 'echo');

// Listen for messages
socket.onmessage = function (event) {
    console.log(event.data);
};

// Send the first message
socket.send('ECHO');
```

Access the server from the browser simpleS WebSocket API:

```js
var socket = simples.ws('/', ['echo']);

// Listen for messages
socket.on('message', function (message) {
    console.log(message.data);
});

// Send the first message
socket.send('ECHO');
```

Access the server from server-side simpleS client WebSocket API:

```js
var simples = require('simples');

var client = simples.client();

var socket = client.ws('/');

// Listen for messages
socket.on('message', function (message) {
    console.log(message.data);
});

// Send the first message
socket.send('ECHO');
```