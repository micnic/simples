<img src="https://raw.github.com/micnic/simpleS/master/logo.png"/>

# 0.9.0-alpha-4

simpleS is a simple web framework for Node.JS designed to create HTTP(S) servers and clients with some special features:

- High performance and simple structure with minimum configuration
- Advanced routing for http requests, static files and errors
- Unique interface for requests and responses (named as connection)
- Response compression (deflate and gzip, disabled by default)
- Virtual Hosting
- CORS support
- Sessions (disabled by default)
- Template engine support
- WebSocket implementation (RFC 6455)
- Client API for HTTP requests and WebSocket connections
- Browser simple API for AJAX and WebSocket

#### Works with node.js 6.0+!
#### Any feedback is welcome!

#### More simple modules:
- [recache](https://www.npmjs.com/package/recache)
- [simpleR](https://www.npmjs.com/package/simpler)
- [simpleT](https://www.npmjs.com/package/simplet)

### Changelog (link will be added soon, check repo for changelog)
### Documentation (link will be added soon, check repo for documentation)

## Installation

    npm install simples@alpha

## Examples

See the folder `examples/` in the module directory, it contains examples that cover most simpleS features.

## Usage

### Server Creation

```js
const simples = require('simples');

const server = simples(); // Your server is set up on port 80

// Catch 404 Error
server.error(404, (connection) => {
    connection.end('Error 404 caught');
});

// Create the first route
server.get('/', (connection) => {
    connection.end('Simples Works');
});
```

### Virtual Hosting

```js
const host0 = server; // The server is in the same time the main host
const host1 = server.host('example.com'); // Other hosts
const host2 = server.host('example2.com');

// Now for each host you can apply individual routing
host0.get('/', (connection) => {
    connection.end('Main Host');
});

host1.get('/', (connection) => {
    connection.end('Host 1');
});

host2.get('/', (connection) => {
    connection.end('Host 2');
});
```

### WebSocket

Let's create an echo WebSocket server:

```js
server.ws('/', {
    limit: 1024, // The maximum size of a message
    advanced: false, // Set connection advanced mode, see docs for more info
    origins: ['null'] // Set accepted origins, "null" for localhost
}, (connection) => {

    // Log the new connection
    console.log('New connection');

    // Listen for messages to send them back
    connection.on('message', (message) => {
        console.log('Message: ' + message.data);
        connection.send(message.data);
    });

    // Log connection close
    connection.on('close', () => {
        console.log('Connection closed');
    });
});
```

Access the server from the browser built-in WebSocket API:

```js
const socket = new WebSocket('ws://localhost/', 'echo');

// Listen for messages
socket.onmessage = (event) => {
    console.log(event.data);
};

// Send the first message
socket.send('ECHO');
```

Access the server from the browser simpleS WebSocket API:

```js
const socket = simples.ws('/', ['echo']);

// Listen for messages
socket.on('message', (message) => {
    console.log(message.data);
});

// Send the first message
socket.send('ECHO');
```

Access the server from server-side simpleS client WebSocket API:

```js
const simples = require('simples');

const client = simples.client();

const socket = client.ws('/');

// Listen for messages
socket.on('message', (message) => {
    console.log(message.data);
});

// Send the first message
socket.send('ECHO');
```

### Client Creation

```js
const simples = require('simples');

const client = simples.client();

// GET request
client.get('/').on('body', (response, body) => {
    console.log('Response status: ' + response.status);
    console.log('Response body: ' + body.toString());
});

// POST request
client.post('/send').send(/* data */).on('response', (response) => {
    // Do something with the response
}).on('body', (response, body) => {
    console.log('Response body: ' + body.toString());
});
```