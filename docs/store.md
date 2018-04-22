---
id: store
title: Store
sidebar_label: Store
---

`simpleS` uses store implementations to deposit session objects.

## Memory Store

By default `simpleS` uses a memcached store for sessions, which is by design inefficient, does not scale and is meant only for development purpose. For production purpose a custom store implementation should be used. Internally the memory store is checking every minute for expired sessions and removes them. To create a memory store `simples.store()` method should be called without any parameters.

```js
const store = simples.store();
```

## Store Implementation

Third party store implementations have to implement three methods, `.get()`, `.set()`, and `.unset()`, to be compliant with the `simpleS` session management system.

`.get(id, callback)` - method to get a session by the session id from the store, the `callback` parameter should be called as `callback(error, session)`, in the case session was not found the `session` argument should be `null`.

`.set(id, session, callback)` - method to save a session to the store providing the session id and the session object itself, the `callback` parameter should be called as `callback(error)` when the session is saved in the store.

`.unset(id, callback)` - method to remove a session from the store providing the session id, the `callback` parameter should be called as `callback(error)` when the session is removed from the store.

The easiest way to create a custom store is to use `simples.store()` method called with an object as parameter, the object has to implement the required methods for the store.

```js
const store = simples.store({

    // id: string
    // callback: (error: Error, session: simples.Session) => void
    get(id, callback) {
        // Store get method implementation
        // If the session was found callback(null, session) should be called
        // Else an error should be sent with callback(error, null)
    },

    // id: string
    // session: simples.Session
    // callback: (error: Error) => void
    set(id, session, callback) {
        // Store set method implementation
        // If the session was properly set callback(null) should be called
        // Else an error should be sent with callback(error)
    },

    // id: string
    // callback: (error: Error) => void
    unset(id, callback) {
        // Store unset method implementation
        // If the session was properly removed callback(null) should be called
        // Else an error should be sent with callback(error)
    }
});
```

## Usage

Stores are used in the hosts configuration objects

```js
// On server creation the store is used inside the main host configuration object
const server = simples({    // Server configuration object
    config: {               // Main host configuration object
        session: {          // Main host session configuration object
            store           // Store instance
        }
    }
});

// On host creation the store is used inside the host configuration object
server.host('example.com', {    // Host configuration object
    session: {                  // Host session configuration object
        store                   // Store instance
    }
})
```