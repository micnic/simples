---
id: mirror
title: Mirror
sidebar_label: Mirrors
---

`simpleS` allows, using mirrors, to create servers with the same configuration but on different ports.

## Mirror Instance

```js
server.mirror([port, options, callback])
```

| Argument   | Type                               | Default                    |
|:----------:|------------------------------------|----------------------------|
| `port`     | `number`                           | `80` - HTTP, `443` - HTTPS |
| `options`  | `simples.MirrorOptions`            | `null`                     |
| `callback` | `(mirror: simples.Mirror) => void` | `null`                     |
| **return** | `simples.Mirror`                   |                            |

---

#### `.mirror()`
Set a mirror server on the default port 80 with the default options

#### `.mirror(port)`
Set a mirror server on the provided port with the default options

#### `.mirror(options)`
Set a mirror server with the provided options

#### `.mirror(callback)`
Set a mirror server on the default port 80 with the default options then call the callback when the server starts

#### `.mirror(port, options)`
Set a mirror server on the provided port and options

#### `.mirror(port, callback)`
Set a mirror server on the provided port with the default options then call the callback when the server starts

#### `.mirror(options, callback)`
Set a mirror server with the provided options then call the callback when the server starts

#### `.mirror(port, options, callback)`
Set a mirror server with the provided port and options then call the callback when the server starts

---

Mirror instances are configured in the same way [server instances](server.md#server-instance) are configured with the exception the mirrors do not use `config` property as they do not have to configure any main router.

Mirrors are a limited version of servers, which can start, restart or stop, nothing more. The basic use cases for mirrors are the HTTP + HTTPS server pair and additional servers for development purposes. The `.mirror()` method of the server will create and configure a new mirror or will return an existing mirror in the case the port is already occupied by a mirror. Note: mirrors are independent from the main server, if the server is stopped the mirrors are still functional until they are explicitly stopped.

## HTTPS - HTTP server pair

The basic use case for mirrors is the HTTPS - HTTP server pair:

```js
const server = simples({ // The server is set on port 443
    https: {
        key: 'path/to/key.pem',
        cert: 'path/to/cert.pem'
    }
});

const mirror = server.mirror(); // The mirror is set on port 80

// This can be achieved in the other way too

const server = simples(); // The server is set on port 80

const mirror = server.mirror({ // The mirror is set on port 443
    https: {
        key: 'path/to/key.pem',
        cert: 'path/to/cert.pem'
    }
});
```

## Multiple Development Mirrors

The other use case for mirrors are multiple development mirrors on different ports:

```js
const server = simples(); // The server is set on port 80

const mirror1 = server.mirror(8080); // The mirror is set on port 8080
const mirror2 = server.mirror(8081); // The mirror is set on port 8081
const mirror3 = server.mirror(8082); // The mirror is set on port 8082
```

## Data Container

`.data`

Every mirror has a data container to store any meta data about the mirror.

## Starting and Restarting

```js
.start([port, callback])
```

| Argument   | Type                               | Default                    |
|:----------:|------------------------------------|----------------------------|
| `port`     | `number`                           | `80` - HTTP, `443` - HTTPS |
| `callback` | `(mirror: simples.Mirror) => void` | `null`                     |
| **return** | `simples.Mirror`                   |                            |

---

#### `.start()`
Start the mirror server with the current port

#### `.start(port)`
Start or restart the mirror server with the provided port

#### `.start(callback)`
Start the mirror server with the current port then call the callback

#### `.start(port, callback)`
Start or restart the mirror server with the provided port then call the callback

---

Start listening for requests on the provided port. If the mirror is already started and the provided port differs from the mirror's port then `simpleS` will restart the mirror and will listen on the new provided port. Can have an optional callback. All connection in simpleS are kept alive and the restart can take few seconds for closing alive http and ws connections. While restarting, no new connection will be accepted but existing connections will be still served. When the mirror will be started the `start` event will be emitted. This method is called automatically when a new mirror instance is created, it is not needed to call it explicitly on mirror creation. The purpose of this method is to provide a way to switch port. Returns current instance, so calls can be chained.

```js
mirror.start(80, (mirror) => {
    // Application logic
});

// Listen for the start of the mirror
mirror.on('start', (mirror) => {
    // Application logic
});
```

## Stopping

```js
.stop([callback])
```

| Argument   | Type                               | Default |
|:----------:|------------------------------------|---------|
| `callback` | `(mirror: simples.Mirror) => void` | `null`  |
| **return** | `simples.Mirror`                   |         |

---

#### `.stop()`
Stop the mirror server

#### `.stop(callback)`
Stop the mirror server then call the callback

---

Stop the mirror. Can have an optional callback. All connection in simpleS are kept alive and the closing can take few seconds for closing alive http and ws connections. While closing, no new connection will be accepted but existing connections will be still served. When the mirror will be stopped the `stop` event will be emitted. Returns current instance, so calls can be chained.

```js
mirror.stop((mirror) => {
    // Application logic
});

// Listen for the stop of the mirror
mirror.on('stop', (mirror) => {
    // Application logic
});
```

## Error Handling

Any mirror instance is an event emitter, all possible errors that may appear at the level of the mirror can be caught using the usual error event listener attached to the instance. It is recommended to attach error event listeners to the mirror to prevent any undesired behavior.

```js
mirror.on('error', (error) => {
    // Handle any error that occurs at the mirror level
});
```