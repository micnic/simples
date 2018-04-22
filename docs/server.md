---
id: server
title: Server
sidebar_label: Server
---

`simpleS` provides the simplest way to create a HTTP(S) server instance.

## Server Instance

```js
simples([port, options, callback])

// or

simples.server([port, options, callback])
```

| Argument   | Type                               | Default                    |
|:----------:|------------------------------------|----------------------------|
| `port`     | `number`                           | `80` - HTTP, `443` - HTTPS |
| `options`  | `simples.ServerOptions`            | `null`                     |
| `callback` | `(server: simples.Server) => void` | `null`                     |
| **return** | `simples.Server`                   |                            |

---

#### `simples()`
Set a server on the default port 80 with the default options

#### `simples(port)`
Set a server on the provided port with the default options

#### `simples(options)`
Set a server with the provided options

#### `simples(callback)`
Set a server on the default port 80 with the default options then call the callback when the server starts

#### `simples(port, options)`
Set a server on the provided port and options

#### `simples(port, callback)`
Set a server on the provided port with the default options then call the callback when the server starts

#### `simples(options, callback)`
Set a server with the provided options then call the callback when the server starts

#### `simples(port, options, callback)`
Set a server with the provided port and options then call the callback when the server starts

---

All arguments are optional, `simpleS` will apply defaults to create the server instance.

`port` argument specifies on which port the server should be listening, this value overwrites the port value from the `options` argument. By default this value is set to 80 for HTTP servers and 443 for HTTPS servers.

`options` argument specifies general server configuration like main router configuration, port, hostname, backlog or HTTPS options, it has the following structure:

```js
{
    config: {},             // Main router configuration, see Router docs
    port: 80,               // Port, default is 80 for HTTP and 443 for HTTPS
    hostname: '0.0.0.0',    // Hostname from which to accept connections
    backlog: 511,           // The maximum length of pending connections
    https: {}               // Options for setting up a HTTPS server
}
```

`options` argument, basically, implements the [`http.Server.listen()`](https://nodejs.org/api/http.html#http_server_listen) method with the possibility to create a HTTPS server by defining the [TLS options](https://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener). Also it provides the possibility to define the main router configuration, see [HttpRouter docs](http-router.md) for detailed information.

`callback` argument specifies a function which is triggered when the server is started for the first time, it will receive one argument, which is the server itself.

Server class extends the HttpHost class, so the server is in the same time the main host and has all the methods and properties of the HttpHost, see [HttpHost docs](http-host.md) for detailed information.

## HTTP Server Instance

To create a HTTP server use one of the following approaches:

```js
const server = simples(80);

// or simpler

const server = simples(); // The server will be set on port 80

// or with the port and a callback

simples(80, (server) => {
    // Do something with the server instance
});

// or with just the callback

simples((server) => { // The server is also set on port 80
    // Do something with the server instance
});
```

## HTTPS Server Instance

If the `https` property is present in the `options` argument the created server is a HTTPS server. These HTTPS options should be the same as they would pe provided for [`https.Server`](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener) with the exception that for the `key` and `cert` or `pfx` properties should be paths to the `.pem` or `.pfx` files, `simpleS` will resolve their content when it is required. Note: by creating a HTTPS server there will be no HTTP server provided, a mirror should be created for this purpose (see Mirror docs for more info).

To create a HTTPS server use one of the following approaches:

```js
const server = simples(443, {
    https: {
        key: 'path/to/key.pem',
        cert: 'path/to/cert.pem'
    }
});

// or just

const server = simples({ // The server will be set on port 443
    https: {
        key: 'path/to/key.pem',
        cert: 'path/to/cert.pem'
    }
});

// or with a callback

simples({ // The server is also set on port 443
    https: {
        key: 'path/to/key.pem',
        cert: 'path/to/cert.pem'
    }
}, (server) => {
    // Do something with the server object
});

// Add a HTTP mirror
server.mirror(); // The mirror is set on port 80, see Mirror docs
```

To redirect the client to HTTPS try [simples-redirect](https://www.npmjs.org/package/simples-redirect) middleware.

## Starting and Restarting

```js
.start([port, callback])
```

| Argument   | Type                               | Default                    |
|:----------:|------------------------------------|----------------------------|
| `port`     | `number`                           | `80` - HTTP, `443` - HTTPS |
| `callback` | `(server: simples.Server) => void` | `null`                     |
| **return** | `simples.Server`                   |                            |

---

#### `.start()`
Start the server with the current port

#### `.start(port)`
Start or restart the server with the provided port

#### `.start(callback)`
Start the server with the current port then call the callback

#### `.start(port, callback)`
Start or restart the server with the provided port then call the callback

---

Start listening for requests on the provided port. If the server is already started and the provided port differs from the server's port then simpleS will restart the server and will listen on the new provided port. Can have an optional callback. All connection in simpleS are kept alive and the restart can take few seconds for closing alive http and ws connections. While restarting, no new connection will be accepted but existing connections will be still served. When the server will be started the `start` event will be emitted. This method is called automatically when a new simpleS instance is created, it is not needed to call it explicitly on server creation. The purpose of this method is to provide a way to switch port. Returns current instance, so calls can be chained.

```js
server.start(80, (server) => {
    // Application logic
});

// Listen for the start of the server
server.on('start', (server) => {
    // Application logic
});
```

## Stopping

```js
.stop([callback])
```

| Argument   | Type                               | Default |
|:----------:|------------------------------------|---------|
| `callback` | `(server: simples.Server) => void` | `null`  |
| **return** | `simples.Server`                   |         |

---

#### `.stop()`
Stop the server

#### `.stop(callback)`
Stop the server then call the callback

---

Stop the server. Can have an optional callback. All connection in simpleS are kept alive and the closing can take few seconds for closing alive http and ws connections. While closing, no new connection will be accepted but existing connections will be still served. When the server will be stopped the `stop` event will be emitted. Returns current instance, so calls can be chained.

```js
server.stop((server) => {
    // Application logic
});

// Listen for the stop of the server
server.on('stop', (server) => {
    // Application logic
});
```

## Mirrors

```js
.mirror([port, options, callback])
```

`simpleS` provide a way to have multiple servers with the same hosts and routes but on different ports and different configuration, this is done using mirror servers.

See [Mirror docs](mirror.md) for detailed information.

## Virtual Hosting

```js
.host(name[, options])
```

`simpleS` allows having multiple HTTP hosts on the same server.

See [HttpHost docs](http-host.md) for detailed information.

## Error Handling

Any server instance is an event emitter, all possible errors that may appear at the level of the server can be caught using the usual error event listener attached to the instance. It is recommended to attach error event listeners to the server to prevent any undesired behavior.

```js
server.on('error', (error) => {
    // Handle any error that occurs at the server level
});
```