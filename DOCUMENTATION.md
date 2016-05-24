## Table of Contents:

### [New simpleS Instance](#server)
### [Server Management](#server-management)
> ##### [Starting and Restarting](#server-start)

> ##### [Stopping](#server-stop)

> ##### [Server error handling](#server-error-handling)

> ##### [Mirrors](#mirrors)

> ##### [Virtual Hosting](#server-host)

> ##### [Host Configuration](#server-host-config)

> ##### [Middlewares](#middlewares)

> ##### [Templating](#server-templating)

### [Routing](#host-routing)
>##### [All Requests](#host-all)

>##### [DELETE Requests](#host-del)

>##### [GET Requests](#host-get)

>##### [POST Requests](#host-post)

>##### [PUT Requests](#host-put)

>##### [General Routing](#host-route)

>##### [Error Routes](#host-error)

>##### [Examples for routes](#example-routes)

>##### [Static Files](#host-serve)

>##### [Removing Routes](#host-leave)

### [Connection Interface](#http-connection)
>##### [.cookies](#http-connection-cookies)

>##### [.data](#http-connection-data)

>##### [.headers](#http-connection-headers)

>##### [.host](#http-connection-host)

>##### [.ip](#http-connection-ip)

>##### [.langs](#http-connection-langs)

>##### [.method](#http-connection-method)

>##### [.params](#http-connection-params)

>##### [.path](#http-connection-path)

>##### [.protocol](#http-connection-protocol)

>##### [.query](#http-connection-query)

>##### [.request](#http-connection-request)

>##### [.response](#http-connection-response)

>##### [.session](#http-connection-session)

>##### [.url](#http-connection-url)

>##### [.parse(config)](#http-connection-parse)

>##### [.cookie(name, value[, attributes])](#http-connection-cookie)

>##### [.header(name[, value])](#http-connection-cookie)

>##### [.lang([value])](#http-connection-lang)

>##### [.link(links)](#http-connection-link)

>##### [.redirect(location[, permanent])](#http-connection-redirect)

>##### [.status([code])](#http-connection-status)

>##### [.type([type, override])](#http-connection-type)

>##### [.keep([timeout])](#http-connection-keep)

>##### [.write(chunk[, encoding, callback])](#http-connection-write)

>##### [.end([chunk, encoding, callback])](#http-connection-end)

>##### [.send(data[, replacer, space])](#http-connection-send)

>##### [.drain(location[, type, override])](#http-connection-drain)

>##### [.render(source[, imports])](#http-connection-render)

>##### [.log([stream, ]data)](#http-connection-log)

>##### [.close([callback])](#http-connection-close)

>##### [.destroy()](#http-connection-destroy)

### [WebSocket](#websocket)
>##### [WebSocket Host](#ws-host)

>##### [WebSocket Connection](#ws-connection)

>##### [WebSocket Channel](#ws-channel)

### [Client Simple API](#client-api)
>##### [HTTP Request](#client-api-http)

>##### [WS Connection](#client-api-ws)

### [Browser Simple API](#browser-api)
>##### [AJAX (Asynchronous JavaScript and XML)](#browser-api-ajax)

>##### [Event Emitter](#browser-api-ee)

>##### [WS (WebSocket)](#browser-api-ws)

```js
var simples = require('simples');
```

# <a name="server"/> New simpleS Instance

`simples([port, options, callback])` or `simples.server([port, options, callback])`

port: number

options: object

callback: function(server: object)

simpleS needs only the port number to set up a HTTP server on this port. Additionally options and a callback can be defined.

The `options` parameter can have the following structure:

```js
{
    port: 80,               // Port, default is 80 for HTTP and 443 for HTTPS, note that this value may be overwritten by the port parameter
    hostname: '0.0.0.0',    // Hostname from which to accept connections, by default will accept from any address
    backlog: 511,           // The maximum length of the queue of pending connections, default is 511, but is determined by the OS
    https: {}               // Options for setting up a HTTPS server, more info: https://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
}
```

The `options` parameter, basically, implements the [`http.Server.listen()`](https://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback) method with the possibility to create a HTTPS server by defining the [TLS options](https://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener).

If a callback function is defined then it is triggered when the server is started, it will receive one argument, which is the server itself.

Simplest use case to create a HTTP server:

```js
var server = simples(80);

// or simpler

var server = simples(); // The server will be set on port 80

// or with the port and a callback

simples(80, function (server) {
    // Do something with the server object
});

// or with just the callback

simples(function (server) { // The server is also set on port 80
    // Do something with the server object
});
```

If the `https` property is present in the `options` parameter the created server is a HTTPS server. These HTTPS options should be the same as they would pe provided for [`https.Server`](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener) with the exception that for the `key` and `cert` or `pfx` properties should be paths to the `.pem` or `.pfx` files, simpleS will resolve their content when it is required. Note: by creating a HTTPS server there will be no HTTP server provided, a mirror should be created for this purpose (see Mirror for more informations).

Simplest use case to create a HTTPS server:

```js
var server = simples(443, {
    https: {
        key: 'path/to/key.pem',
        cert: 'path/to/cert.pem'
    }
});

// or just

var server = simples({ // The server will be set on port 443
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
}, function (server) {
    // Do something with the server object
});

// Add a HTTP mirror
server.mirror(); // See Mirror for more info
```

To redirect the client to HTTPS, use a structure like this:

```js
server.get('/', function (connection) {
    if (connection.protocol === 'http') {
        connection.redirect('https://' + connection.url.host + connection.url.path, true);
    } else {
        // Application logic
    }
});
```

or try [simples-redirect](https://www.npmjs.org/package/simples-redirect) middleware with some more options.

## <a name="server-management"/> Server Management

### <a name="server-start"/> Starting and Restarting

`.start([port, callback])`

port: number

callback: function(server: object)

Start listening for requests on the provided port. If the server is already started and the provided port differs from the server's port then simpleS will restart the server and will listen on the new provided port. Can have an optional callback. All connection in simpleS are kept alive and the restart can take few seconds for closing alive http and ws connections. While restarting, no new connection will be accepted but existing connections will be still served. When the server will be started the `start` event will be emitted. This method is called automatically when a new simpleS instance is created, it is not needed to call it explicitly on server creation. The purpose of this method is to provide a way to switch port. Returns current instance, so calls can be chained.

```js
server.start(80, function (server) {
    // Application logic
});

// Listen for the start of the server
server.on('start', function (server) {
    // Application logic
});
```

### <a name="server-stop"/> Stopping

`.stop([callback])`

callback: function(server: object)

Stop the server. Can have an optional callback. All connection in simpleS are kept alive and the closing can take few seconds for closing alive http and ws connections. While closing, no new connection will be accepted but existing connections will be still served. When the server will be stopped the `stop` event will be emitted. Returns current instance, so calls can be chained.

```js
server.stop(function (server) {
    // Application logic
});

// Listen for the stop of the server
server.on('stop', function (server) {
    // Application logic
});
```

### <a name="server-error-handling"/> Server error handling

Any server instance is an event emitter, all possible errors that may appear at the level of the server can be caught using the usual error event listener attached to the instance object. The same approach can be applied for HTTP and WS hosts, in this case the error listeners will catch errors to the level of the host. It is recommended to attach error event listeners to the server, mirror and all its hosts to prevent any undesired behavior.

```js
server.on('error', function (error) {
    // Handle any fatal error that may occur at the level of the server
});

mirror.on('error', function (error) {
    // Handle any fatal error that may occur at the level of the mirror
});

host.on('error', function (error) {
    // Handle any error that occurs at the level of the host
});
```

### <a name="mirrors"/> Mirrors

`.mirror([port, options, callback])`

port: number

options: object

callback: function(mirror: object)

To create additional server instances which will use the same hosts and routes but on different ports use the mirrors. Mirrors are a limited version of servers, which can start, restart, stop or be destroyed, nothing more. The basic use cases for mirrors are the HTTP + HTTPS server pair and additional servers for development purposes. The parameters for creating a mirror are the same as for creating a server. This method will create and configure a new mirror or will return an existing mirror in the case the port is already occupied by a mirror. Note: mirrors are independend from the main server, if the server is stopped the mirrors are still functional until they are explicitly stopped.

```js
var mirror = server.mirror(12345, function (mirror) {
    // Do something with the mirror
});

// To destroy a mirror simply call `.destroy()` method
mirror.destroy();
```

### <a name="server-host"/> Virtual Hosting

`.host(name[, options])`

name: string

options: object

simpleS can serve multiple domains on the same server and port, using `.host()` method it is simple to specify which host should use which routes. By default, simpleS has the main host which will route all existent routes of the simpleS instance, this is vital for one host on server or when it is needed a general behavior for incoming requests. This method will create and configure a new host or will return an existing host with a changed configuration.

```js
var host = server.host('example.com');

// or define a host with a wildcard

var host = server.host('*.example.com');

// options can be added to the host definition

var host = server.host('example.com', {
    compression: {
        enabled: true
    },
    session: {
        enabled: true
    }
});
```

#### Host local data container

Each simpleS host has a `.data` property which represents an object container to store any data which is necessary for the host or the application in general.

#### <a name="server-host-config"/> Host Configuration

`.config(options)`

options: object

Change the configuration of the host. Returns current instance, so calls can be chained. Possible attributes for the configuration:

##### Compression configuration:
```js
compression: {
    enabled: false,         // Activate the compression, by default the compression is disabled
    filter: /^.+$/,        // Filter content types that will be compressed, by default all kinds of file types are compressed
    options: null,          // Compression options, see more on https://nodejs.org/api/zlib.html#zlib_class_options
    preferred: 'deflate'    // The preferred compression type, can be 'deflate' or 'gzip', by default is `deflate`
}
```

By default, the compression is disabled. When enabled it is applied on all connections with default zlib options and preferred `deflate` compression.

##### Cross-Origin Resource Sharing configuration (CORS):
```js
cors: {
    credentials: false,                                 // Allow HTTP credentials, by default false
    headers: [],                                        // Set of accepted headers
    methods: ['DELETE', 'GET', 'HEAD', 'POST', 'PUT'],  // Set of accepted methods
    origins: []                                         // Set the origins accepted by the host, note the description below
}
```

By default, the server will accept requests only from the current host. To accept requests from any origin use `'*'`, if this parameter is used as the first parameter then all next origins are rejected. `'null'` is used for local file system origin. These limitations will be applied on all requests unsing CORS. The current host should not be added in the list, it is accepted anyway. Examples of use:
```js
['null', 'localhost', 'example.com']    // Will accept requests only from these 3 hosts

['*', 'example.com']                    // Will accept requests from all hosts except 'example.com'
```

##### Session configuration:
```js
session: {
    enabled: false,             // Activate the session, by default sessions are disabled
    store: simples.store(3600), // Session store, the default is simples memcached store with 1 hour timeout
}
```

Sessions are stored by default inside a memcached container, to define another container for them it is needed an object instance with the next methods:

`.get(id, callback)` - should return inside the callback function the session container if it is found, if the session defined by the `id` parameter is not found then the callback function should return `null`;

`.set(id, session, callback)` - should add the session container defined by the first two paramters and execute the callback function when the session container is saved to the sessions storage.

Note: The third party session stores have to implement their own technique for cleaning up expired sessions, if needed.

##### Timeout
```js
timeout: 5000 // miliseconds of connection inactivity, default is 5 seconds
```

All connections are limited in time of inactivity, by default this time is limited to 5 seconds. To remove the inactivity timeout the 0 value should be set in the `timeout` option.

### <a name="server-host-middleware"/> Middlewares

`.middleware(middleware[, remove])`

middleware: function(connection: object, next: function(stop: boolean)) or array[function(connection, next)]

remove: boolean

Each host accepts middlewares to be implemented, which allow to add some additional functional with a global behavior which is not available out of the box. The middlewares can manipulate the connection object and to call the next middleware in the chain or the internal simpleS functional. The order in which middlewares are defined has importance because they will be executed in the same way. simpleS will prevent the same middleware to be attached. To remove a middleware from the list its reference should be provided as the first parameter and the second parameter should be a `true` value. Returns current instance, so calls can be chained.

```js
host.middleware(function (connection, next) {
    if (connection.path === '/restricted' && !connection.session.user) {
        connection.end('You are not allowed to be here');
        next(true); // Will stop the middleware chain and connection routing
    } else {
        next();     // Will continue to the next middleware if it exists or will continue to connection routing
    }
});

// another example, a middleware to set X-Powered-By header for all connections

host.middleware(function (connection, next) {
    connection.header('X-Powered-By', 'simpleS');
    next();
});
```

`.use(middleware)`

middleware: function(connection: object, next: function(stop: boolean)) or array[function(connection, next)]

Synonym method for adding middlewares.

`.unuse(middleware)`

middleware: function(connection: object, next: function(stop: boolean)) or array[function(connection, next)]

Synonym method for removing middlewares.

### <a name="server-templating"/> Templating

`.engine(engine)`

engine: object

To render templates it is necessary to define the needed template engine which has a `.render()` method. The rendering method should accept 1, 2 or 3 parameters, `source`, `imports` and/or callback, `source` should be a string that defines the path to the templates, `imports` may be an optional parameter and should be an object containing data to be injected in the templates, `callback` is a function that is called if the result is generated asynchronously. The templates are rendered using the `.render()` method of the Connection Interface. If the template engine does not correspond to these requirements then a wrapper object can be applied to make it be compatible. See the examples below to understand how to make any template engine compatible with `simpleS`. The template engine may be used to render HTTP responses and WebSocket messages. This method is applicable on each host independently (see Virtual Hosting). Returns current instance, so calls can be chained. Recommended template engine: [simpleT](https://www.npmjs.com/package/simplet).

```js
// Noop template engine example
var noopEngine = {
    render: function (source) {
        console.log(source);
        return source;
    }
};

host.engine(noopEngine);

// Asynchronous noop template engine example
var noopAsyncEngine = {
    render: function (source, imports, callback) {
        setTimeout(function () {
            // Do something with the source and the imports
            callback(source);
        }, 1000);
    }
};

host.engine(noopAsyncEngine);

// Wrapped unsupported template engine example
var unsupportedEngine = {
    renderFile: function (imports, source) {
        // Do something with the source and the imports
        return source;
    }
};

host.engine({
    render: function (source, imports) {
        unsupportedEngine.renderFile(imports, source);
    }
});
```

To connect any existing template engine which supports Express [simples-engineer](https://www.npmjs.com/package/simples-engineer) can be used.

## <a name="host-routing"/> Routing

All the methods described below are applicable on each host independently (see [Virtual Hosting](#virtual-hosting)). All route paths are case sensitive and should contain only paths without queries to exclude possible unexpected behavior and to ensure improved performance, undesired data will be cut off. All routes are relative to the host root and may not begin with `/`, simpleS will ignore it anyway. The routes may be fixed or can contain named parameters. Fixed routes are fast and simple, while the second ones are more flexible and handy in complex applications. The named parameters in the advanced routes are mandatory, if at least one component of the route is absent in the url then the url is not routed.

```js
'user/john/action/thinking'; // Fixed route

'user/:user/action/:action'; // Advanced routing with named parameters

/*
    This route will match this request url:

    /user/mary/action/cooking

    with parameters:

    {
        user: 'mary',
        action: 'cooking'
    }
*/

'user/:user/*'; // Advanced routing that can match anything

/*
    This route will match these request urls:

    /user/mary/home
    /user/mary/friends/john
*/

```

### <a name="host-all"/> All Requests

`.all(route, listener[, importer])`

route: array[strings] or string

listener: function(connection: object) or string

importer: function(connection: object, callback: function(data: object)) or object

Listen for all supported types of requests (`DELETE`, `GET`, `HEAD`, `POST` and `PUT`) and uses a callback function with connection as parameter or a string for view rendering (see `Connection.render()`). The `importer` parameter is used only if the listener is a string and define the data for the view, as a function, the `callback` should provide an object as parameter to be imported in the view. This method is useful for defining general behavior for all types of requests. This method has less priority than the other methods described below to allow specific behavior for routes. Returns current instance, so calls can be chained.

### <a name="host-del"/> DELETE Requests

`.del(route, listener[, importer])`

route: array[strings] or string

listener: function(connection: object) or string

importer: function(connection: object, callback: function(data: object)) or object

Listen for `DELETE` requests and uses a callback function with connection as parameter or a string for view rendering (see `Connection.render()`). The `importer` parameter is used only if the listener is a string and define the data for the view, as a function, the `callback` should provide an object as parameter to be imported in the view. Returns current instance, so calls can be chained.

### <a name="host-get"/> GET Requests

`.get(route, listener[, importer])`

route: array[strings] or string

listener: function(connection: object) or string

importer: function(connection: object, callback: function(data: object)) or object

Listen for `GET` requests and uses a callback function with connection as parameter or a string for view rendering (see `Connection.render()`). The `importer` parameter is used only if the listener is a string and define the data for the view, as a function, the `callback` should provide an object as parameter to be imported in the view. Returns current instance, so calls can be chained.

### <a name="host-post"/> POST Requests

`.post(route, listener[, importer])`

route: array[strings] or string

listener: function(connection: object) or string

importer: function(connection: object, callback: function(data: object)) or object

Listen for `POST` requests and uses a callback function with connection as parameter or a string for view rendering (see `Connection.render()`). The `importer` parameter is used only if the listener is a string and define the data for the view, as a function, the `callback` should provide an object as parameter to be imported in the view. Returns current instance, so calls can be chained.

### <a name="host-put"/> PUT Requests

`.put(route, listener[, importer])`

route: array[strings] or string

listener: function(connection: object) or string

importer: function(connection: object, callback: function(data: object)) or object

Listen for `PUT` requests and uses a callback function with connection as parameter or a string for view rendering (see `Connection.render()`). The `importer` parameter is used only if the listener is a string and define the data for the view, as a function, the `callback` should provide an object as parameter to be imported in the view. Returns current instance, so calls can be chained.

### <a name="host-route"/> General routing
`.route(verb, route, listener)`

verb: 'all', 'del', 'get', 'put' or 'post'

route: array[strings] or string

listener: function(connection: object)

Add listeners for all types of routes. The methods described above are just shortcuts to this method. For better readability use shortcuts. Returns current instance, so calls can be chained.

### <a name="host-error"/> Error Routes

`.error(code, listener[, importer])`

code: number

listener: function(connection: object) or string

importer: function(connection: object, callback: function(data: object)) or object

Listen for errors that can have place and uses a callback function with connection as parameter or a string for rendering (see `Connection.render()`). Only one method call can be used for a specific error code, if more `.error()` methods will be called for the same error code only the last will be used for routing. Possible values for error codes are any number, but it is recommended to stick to the HTTP standard and use `4xx` for client errors and `5xx` for server errors. By default, only listeners for `404`, `405` and `500` error codes are treated, if no error routes are defined, then the default ones will be used. The internal server error with the `500` status code will populate `connection.data.error` with the error object. To trigger any any defined error route the `estatus` event should be emitted with 2 additional arguments: the error code and the connection object. Inside the listeners there is no need to specify the connection status code, it is assigned automatically depending on the raised error. Returns current instance, so calls can be chained.

#### <a name="example-routes"/> Examples for routing methods:

```js
host.all('/', function (connection) {
    // Application logic
});

host.get([
    '/',
    '/index'
], function (connection) {
    // Application logic
});

host.error(404, 'not_found.ejs');

host.put('/update', 'update.ejs', {
    title: 'Update the page',
    message: 'The page was updated successfully'
});

host.del('/delete', 'delete.ejs', function (connection, callback) {
    db.getModel('delete', function (error, data) {
        if (error) {
            throw error;
        } else {
            callback(data);
        }
    });
});

host.post([
    '/',
    '/index'
], 'index.ejs');
```

### <a name="host-serve"/> Static Files

`.serve(directory[, options, callback])`

directory: string

options: object

callback: function(connection: object)

`directory` is the local path to a folder that contains static files (for example: images, css or js files), this folder will serve as the root folder for the host. Under the hood the [recache](https://www.npmjs.org/package/recache) modules is used for caching the content of the directory, the `options` parameter is optionally used to configure the cache by filtering the cached directories and files with regular expressions (the cache is not persistent). simpleS will return response status 304 (Not Modified) if the files have not been changed since last visit of the client. Only one folder can be used to serve static files, the content of the files inside the folder is read asynchronously and recursively, then it is stored in the memory. The folder with static files can contain other folders, their content will be also served. The provided path must be relative to the current working directory. The `callback` parameter is the same as for `GET` or `POST` requests, but it is triggered only when the client accesses the root of a sub folder of the folder with static files, the `connection.data.files` is populated with array of objects representing the contained files and folders, these objects contain the name and the stats of the files and folders, the `callback` parameter is optional. When the cache has read and stored all directory files the host emits the `serve` event. All files are dynamically cached for better performance, so the provided folder should contain only necessary files and folders not to abuse the memory of the server. Returns current instance, so calls can be chained.

```js
host.serve('static_files', {
    dirs: /^css|img|js$/i,
    files: /\.(?:css|png|js)$/i
}, function (connection) {
    // Application logic
});

// Do something when the cache is ready
host.on('serve', function () {
    // Application logic
});
```

### <a name="host-leave"/> Removing Routes

`.leave([type, route])`

type: 'all', 'del', 'error', 'get', 'post', 'put' or 'serve'

route: 404, 405 or 500 with type 'error' and array[strings] or string with other types

Removes a specific route, a set of routes, a specific type of routes or all routes. If the type and the route is specified, then the route or the set of routes of this type are removed. If only the type is specified, then all routes of this type will be removed. If no parameters are specified, then the routes will be set in their default values. Routes should be specified in the same way that these were added. Returns current instance, so calls can be chained.

```js
host.leave('post');             // All POST routes are removed

host.leave('get', '/nothing');  // One, selected, GET route is removed

host.leave('serve');            // Only one parameter needed, removes the cached static files

host.leave('all', [             // Removes the selected routes for routes with general behavior defined
    '/home',
    '/index'
]);

host.leave('error', 404);       // Removes the route for '404' error code and set the default route for it

host.leave();                   // Removes all routes and set default error routes
```

### <a name="http-connection"/> Connection Interface

The parameter provided in callbacks for routing requests is an object that contains data about the current request and the data sent to the client. The connection interface wraps the request and the response objects that comes from the Node.JS server, these objects can be used for compatibility with some other third party modules. The connection is a transform stream, see [`stream`](http://nodejs.org/api/stream.html) core module for more details.

```js
{
    cookies: {
        user: 'me',
        pass: 'password'
    },
    data: {},
    headers: {
        host: 'localhost:12345',
        'user-agent': 'myBrowser',
        accept: 'text/html',
        'accept-language': 'ro;q=0.8,en;q=0.6',
        'accept-encoding': 'gzip, deflate',
        cookie: 'user=me; pass=password'
    },
    host: 'localhost',
    ip: {
        address: '127.0.0.1',
        family: 'IPv4',
        port: 80
    },
    langs: [
        'ro',
        'en'
    ],
    method: 'GET',
    query: {},
    params: {},
    path: '/',
    protocol: 'http',
    request: { /* Node.JS server request object */ },
    response: { /* Node.JS server response object */ },
    session: {},
    url: {
        /* These will never be filled
        auth: null,
        hash: null,
        */
        host: 'localhost:12345',
        hostname: 'localhost',
        href: 'http://localhost:12345/',
        pathname: '/',
        path: '/',
        port: '12345',
        protocol: 'http:',
        query: {},
        search: '',
        slashes: true
    }
    /* methods */
}
```

#### <a name="http-connection-cookies"/> .cookies

An object that contains the cookies provided by the client.

#### <a name="http-connection-data"/> .data

A container for the data related to the connection but which may not be inside the session.

#### <a name="http-connection-headers"/> .headers

An object that contains the HTTP headers of the request.

#### <a name="http-connection-host"/> .host

The hostname from the `Host` header.

#### <a name="http-connection-ip"/> .ip

An object that describes the remote ip address of the request, it is equivalent to [`net.socket.address()`](http://nodejs.org/api/net.html#net_socket_address).

#### <a name="http-connection-langs"/> .langs

An array of strings that represents languages accepted by the client in the order of their relevance.

#### <a name="http-connection-method"/> .method

The HTTP method of the request, it can be `DELETE`, `GET`, `HEAD`, `POST` and `PUT` for usual requests, but can have a different value on error `405`.

#### <a name="http-connection-params"/> .params

The object that contains named parameters from the route. This object is only populated when the request url match a specific route with named parameters. The named parameters represents strings that are limited only by `/` or the end of the url.

#### <a name="http-connection-path"/> .path

The pathname of the url of the request.

#### <a name="http-connection-protocol"/> .protocol

The name of the protocol of the request, can be `http` or `https`.

#### <a name="http-connection-query"/> .query

The object that contains parsed query string from the url.

#### <a name="http-connection-request"/> .request

The Node.JS server request object instance, may be used for compatibility with some third party modules, not recommended to be used because of some possible side effects.

#### <a name="http-connection-response"/> .response

The Node.JS server response object instance, may be used for compatibility with some third party modules, not recommended to be used because of some possible side effects.

#### <a name="http-connection-session"/> .session

A container used to keep important data on the server-side, the clients have access to this data using the `_session` cookie sent automatically, the `_session` cookie has a value of 40 hexadecimal characters which will ensure security for `1.46 * 10 ^ 48` values. The session cookie is protected by `_hash` cookie also with a width of 40 hexadecimal characters which is a hash from the `_session` key and a secret value. The session is available only before calling the `.end()` method of the connection so all manipulations should be made before the content of the connection is sent to the client, this rule is valid for both HTTP and WS connections.

#### <a name="http-connection-url"/> .url

The url of the request split in components, see [`url`](http://nodejs.org/api/url.html) core module for more details.

#### <a name="http-connection-parse"/> .parse(config)

config: object

Receive and parse data that comes from the client. Is designed to process `JSON`, `urlencoded` and `multipart/form-data`. The raw data can be received using `plain` callback function, the `form` object will behave as a readable stream. It is possible to limit the length of the request data by specifying the `limit` attribute in bytes. For `JSON` and `urlencoded` requests the callback function is simplified to handle only the errors and the final result as an object. It is recommended to always handle errors that may raise while parsing the requests by attaching `error` event listener. The structure of the `config` object:

```js
connection.parse({
    limit: 1024 * 1024, // 1 MB
    plain: function (form) {

        // Form as readable stream
        form.on('readable', function () {
            this.read();
        }).on('end', function () {
            // Do something
        });

        // Or form.pipe(anystream);

        // Form error handling
        form.on('error', function (error) {
            error;
        });
    },
    json: function (error, result) {
        if (error) {
            // Handle errors
        } else {
            // Get the result data
        }
    },
    multipart: function (form) {

        // Get form fields
        form.on('field', function (field) {
            field.name;

            if (field.filename) {   // File received
                field.filename;
                field.type;         // Content-Type of the file
            }

            field.on('readable', function () {
                this.read();
            }).on('end', function () {
                // Do something
            });

            // Or field.pipe(anystream);

            // Field error handling
            field.on('error', function (error) {
                error;
            });
        });

        // Check for form ending
        form.on('end', function () {
            // Do something
        });

        // Form error handling
        form.on('error', function (error) {
            error;
        });
    },
    urlencoded: function (error, result) {
        if (error) {
            // Handle errors
        } else {
            // Get the result data
        }
    }
});
```

#### <a name="http-connection-cache"/> .cache([options])

options: null, object or string

Sets, gets or removes the `Cache-Control` header. By providing a string the `Cache-Control` header will be set with this string. `options` argument as an object can have 3 properties: `type` - for the type of the cache, which can be `public` or `private`, by default is `private`, `maxAge` - for the time to live of the cache in seconds and `sMaxAge` - for the time to live of the shared cache, also in seconds.

```js
connection.cache({
    type: 'public', // type of the cache, can be 'private' or 'public', by default is private
    maxAge: 3600,   // max age of the cache in seconds, by default is not defined
    sMaxAge: 3600   // max age of the shared cache in seconds, by default is not defined
});

// or

connection.cache('public, max-age=3600, s-maxage=3600');

// Get the value of the Cache-Control header
connection.cache(); // => public, max-age=3600, s-maxage=3600
```

#### <a name="http-connection-cookie"/> .cookie(name, value[, attributes])

name: string

value: string

attributes: object

Sets the cookies sent to the client, providing a name, a value and an object to configure the expiration time, to limit the domain and the path and to specify if the cookie is http only. To remove a cookie on the client the expiration time should be set to `0`. Can be used multiple times, but before writing any data to the connection. Returns current instance, so calls can be chained.

```js
connection.cookie('user', 'me', {
    expires: 3600,          // or maxAge: 3600, Set the expiration time of the cookie in seconds
    path: '/path/',         // Path of the cookie, should be defined only if it is different from the root, the root slash may be omitted, it will be added
    domain: 'localhost',    // Domain of the cookie, should be defined only if it is different from the current host
    secure: false,          // Set if the cookie is secured and should be used only with HTTPS
    httpOnly: false,        // Set if the cookie can not be modfied from client-side
});
```

#### <a name="http-connection-header"/> .header(name[, value])

name: string

value: array[strings], boolean, number, string or null

Sets, gets or removes a header of the response. Usually simpleS manages the headers of the response by itself setting the cookies, the languages, the content type or when redirecting the client, in these cases the method `.header()` should not be used. If the header already exists in the list then its value will be replaced. To send multiple headers with the same name the value should be an array of strings. If the `value` parameter is not defined then the value of the previously set header defined by the `name` parameter is returned, in other cases the current instance is returned, so calls can be chained. If the `value` parameter is `null` then the header defined by the `name` parameter is removed from the response. Bolean and numeric values are stringified before being applied.

```js
connection.header('ETag', '0123456789');    // Set the 'ETag' header as '0123456789'

connection.header('ETag');                  // => '0123456789'

connection.header('ETag', null);            // The 'ETag' header is being removed

connection.header('ETag');                  // => undefined
```

#### <a name="http-connection-lang"/> .lang([value])

value: null or string

Sets, gets or removes the language of the response. Should be used only once before writing any data to the connection. If the `value` parameter is not defined then the value of the previously set language is returned, in other cases the current instance is returned, so calls can be chained. If the `value` parameter is `null` then the `Content-Language` header is is removed from the response.

```js
connection.lang('ro');  // Set the 'Content-Language' header as 'ro'

connection.lang();      // => 'ro'

connection.lang(null);  // The 'Content-Language' header is being removed

connection.lang();      // => undefined
```

#### <a name="http-connection-link"/> .link([links])

links: object or null

Define the relations of the current location with the other locations and populate `Link` header. Returns current instance, so calls can be chained.

```js
connection.link({
    next: '/page/2',
    prev: '/page/0'
});

// Link: </page/2>; rel="next", </page/0>; rel="prev"
```

#### <a name="http-connection-redirect"/> .redirect(location[, permanent])

location: string

permanent: boolean

Redirects the client to the provided location. If the redirect is permanent then the second parameter should be set as true. For permanent redirects the code `302` is set, for temporary redirects - `301`. Should not be used with the other methods except `.cookie()`, which should be placed before. Returns current instance, so calls can be chained.

```js
connection.redirect('/index', true);
```

#### <a name="http-connection-status"/> .status([code])

code: number

Sets or gets the status code of the response. If the `code` parameter is not defined then the current status code is returned. Returns current instance, so calls can be chained.

```js
connection.status();    // => 200

connection.status(201); // Set the response HTTP status code to 201 (Created)

connection.status();    // => 201
```

#### <a name="http-connection-type"/> .type([type, override])

type: string

override: boolean

Sets, gets or removes the type of the content of the response. Uses the content types defined in [mime.json](https://www.npmjs.org/package/mime.json). This method should be used only once before writing any data to the connection. If the content type header is not set correctly or the exact value of the type is known it is possible to override using the second parameter with true value and setting the first parameter as a valid content type. The second parameter is optional. If the required type is unknown `application/octet-stream` will be applied. If the `type` parameter is not defined then the value of the previously set content type is returned, in other cases the current instance is returned, so calls can be chained. If the `type` parameter is `null` then the `Content-Type` header is removed from the response, it is not recommended to remove the `Content-Type` from the response. By default the `text/html;charset=utf-8` type is set.

```js
connection.type('txt');                 // Set the 'Content-Type' header as 'text/plain;charset=utf-8'

connection.type();                      // => 'text/plain;charset=utf-8'

connection.type('text/plain', true);    // Set the exact defined value to the 'Content-Type' header

connection.type();                      // => 'text/plain'
```

#### <a name="http-connection-keep"/> .keep([timeout])

timeout: number

Each connection has a 5 seconds timeout for inactivity on the socket to prevent too many connections in the same time. To change the value of this timeout the `.keep()` method is called with the a new value in miliseconds, `0` for removing the timeout. Returns current instance, so calls can be chained.

```js
connection.keep();      // or connection.keep(0); removes the timeout

connection.keep(10000); // sets the timeout for 10 seconds
```

#### <a name="http-connection-write"/> .write(chunk[, encoding, callback])

Writes to the connection stream, same as [stream.writable.write](http://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1)

#### <a name="http-connection-end"/> .end([chunk, encoding, callback])

Ends the connection stream, same as [stream.writable.end](http://nodejs.org/api/stream.html#stream_writable_end_chunk_encoding_callback)

#### <a name="http-connection-send"/> .send(data[, replacer, space])

data: any

replacer: array[numbers or strings] or function(key: string, value: any)

space: number or string

Writes preformatted data to the connection stream and ends the connection, implements the functionality of `JSON.stringify()` for arrays, booleans, numbers and objects, buffers and strings are sent as they are. If the connection does not have a `Content-Type` defined and the `data` parameter is not a buffer nor a string then it will have the type `application/json`. Should be used only once and should not be used with `.write()` or `.end()` methods.

```js
connection.send(['Hello', 'World']);
```

#### <a name="http-connection-drain"/> .drain(location[, type, override])

location: string

type: string

override: boolean

Get the content of the file located on the specified location and write it to the connection stream. Will set the content type of the file, can have the parameters from the `.type()` method. Should be used only once and should not be used with `.write()` or `.end()` methods. Is equivalent to `fs.ReadStream(location).pipe(connection.type(type, override))` so the response content is not cached and this method should not be used for static content.

```js
connection.drain('path/to/index.html', 'text/html', true);
```

#### <a name="http-connection-render"/> .render(source[, imports])

source: string

imports: object

Renders the response using the template engine defined by the host in `.engine()` method (see Templating). `simpleS` will insert the `connection` in the `imports` object for convenince. Should be used only once and should not be used with `.write()` or `.end()` methods.

```js
connection.render('/path/to/template.ejs', {
    world: 'World'
});
```

#### <a name="http-connection-log"/> .log([stream, ]data)

stream: writable stream

data: any data

Log data to a defined stream or to the process.stdout by default. The data may contain some special tokens to insert useful data. Accepted tokens:

`%req[HEADER]` - insert the value of a request header

`%res[HEADER]` - insert the value of a response header

`%protocol` - insert the protocol used by the connection (`http(s)` or `ws(s)`)

`%method` - insert the method of the request

`%host` - insert the hostname of the request

`%path` - insert the pathname of the request

`%ip` - insert the remote ip address

`%status` - insert the status code of the response

`%lang` - insert the defined `Content-Language` header for the response

`%type` - insert the defined `Content-Type` header for the response

Time related tokens:

`%date` - insert the string representing current date

`%short-date` - insert the current date in the format `dd.mm.yyyy`

`%time` - insert the current time in the format `hh:mm:ss`

`%short-time` - insert the current time in the format `hh:mm`

`%timestamp` - insert the UNIX time value

`%year` - insert the current year as a 4 digit number

`%month` - insert the current month of the year

`%day` - insert the current day of the month

`%hour` - insert the current hour of the day

`%minute` - insert the current minute of the hour

`%second` - insert the current second of the minute

```js
connection.log('%short-date %time %method %host%path'); // Writes to the log stream something like "01.01.1970 00:00:00 GET localhost/index"
```

#### <a name="http-connection-close"/> .close([callback])

callback: function()

Closes the connection and append an optional callback function to the `finish` event. It is similar to the `.end()` method but has only the callback parameter, can be used as a semantic synonym of the `.end()` method.

```js
connection.close(function () {
    console.log('Connection closed');
});
```

#### <a name="http-connection-destroy"/> .destroy()

Destroy the underlaying network socket, it is mostly used internally by the framework and is not recommended in resulting apps.

## <a name="websocket"/> WebSocket

The WebSocket host is linked to the current or the main HTTP host (see Virtual Hosting).

### <a name="ws-host"/> WebSocket Host

`.ws(location[, options], listener)`

location: string

options: object

listener: function(connection: object)

Create a WebSocket host and listen for WebSocket connections. The host is set on the specified location, can be configured to limit messages size by setting the `limit` attribute in the `options` parameter in bytes, default is 1048576 (1 MiB). The host can work in three modes, `binary`, `text` and `object`, in the `binary` and `text` mode only one type of messages can be send, with binary or text data, in these modes the host works in plain WebSocket protocol, it works faster but does not suppose any semantics for the messages. `object` mode allows multiple types of messages differenciated by different events, it is more flexible, because it adds an abstraction layer of JSON-based messages, but involves a bit more computing resources. By default, only connections from the current host are allowed, but it's possible to define any other host including the localhost as `null` in the `origins` member in configuration object, it's the same approach used for the http host CORS configuration. All connections have an inactivity timeout, which is by default 30000 miliseconds (30 seconds), the `timeout` options is used to change it, the minimal value accepted is 2 seconds timeout, to remove it use the zero value.

```js
var echo = server.ws('/', {
    limit: 1024,
    mode: 'text',
    origins: [],
    timeout: 60000
}, function (connection) {
    // Application logic
});
```

To access the currently active connections the `.connections` property should be used. This is an array, which should not be mutated to prevent any undesired behavior.

#### <a name="ws-host-config"/> .config([options, callback])

options: object

callback: function(connection: object)

Restarts the WebSocket host with new configuration and callback. The missing configuration parameters will not be changed. Returns current instance, so calls can be chained.

```js
echo.config({
    limit: 512,
}, function (connection) {
    // Application logic
});
```

#### <a name="ws-host-broadcast"/> .broadcast([event, ]data[, filter])

event: string

data: string or buffer

filter: function(connection: object, index: number, connection: array[objects])

Sends a message to all connected clients. Clients can be filtered by providing the `filter` parameter, equivalent to `Array.filter()`. `filter` use should be minimized for high performance. Emits `broadcast` event with `event` and / or `data` as parameters. Returns current instance, so calls can be chained.

```js
echo.broadcast('HelloWorld', function (element, index, array) {
    return element.protocols.indexOf('echo') >= 0; // Will send the message to clients that use "chat" as a sub protocol
});
```

#### <a name="ws-host-channel"/> .channel(name[, filter])

name: string

filter: function(connection: object, index: number, connection: array[objects])

Opens a new channel with the provided name. If `filter` is defined, then all the connections of the WebSocket host that respect the filter callback will be bound to the channel. The channel is bound to the WebSocket host. See WebSocket Channel for more information.

#### <a name="ws-host-destroy"/> .destroy()

Destroy all existing connections and remove the host from the WebSocket hosts list.

### <a name="ws-connection"/> WebSocket Connection

The object that represents the current WebSocket connection. The WebSocket connection is an writable stream, see [`stream`](file:///usr/share/doc/nodejs/api/stream.html#stream_class_stream_writable) core module for more details, and has some attributes from connection interface to handle needed data from the handshake request.

#### <a name="ws-connection-members"/> WebSocket Connection Members

`.cookies`

See Connection Interface `.cookies`.

`.data`

See Connection Interface `.data`.

`.headers`

See Connection Interface `.headers`.

`.host`

See Connection Interface `.host`.

`.ip`

See Connection Interface `.ip`.

`.langs`

See Connection Interface `.langs`.

`.protocols`

The array of protocols of the WebSocket connection.

`.query`

See Connection Interface `.query`.

`.session`

See Connection Interface `.session`.

`.url`

See Connection Interface `.url`.

`.write(chunk[, encoding, callback])`

Writes to the connection socket, same as [stream.writable.write](http://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1)

`.end([chunk, encoding, callback])`

Ends the connection socket, same as [stream.writable.end](http://nodejs.org/api/stream.html#stream_writable_end_chunk_encoding_callback)

`.log([stream, ]data)`

See Connection Interface `.log([stream, ]data)`.

`.send([event, ]data)`
event: string

data: any

Sends a message to the client. In `object` mode the event parameter is needed for sending data. All non-string data is stringified.

`.render([event, ]source[, imports])`
event: string

source: string

imports: object

Using the template engine, send data through the WebSocket connection.

`.close([callback])`
callback: function()

See Connection Interface `.close([callback])`.

`.destory()`

See Connection Interface `.destroy()`.

#### <a name="ws-connection-events"/> WebSocket Connection Events

As the WebSocket connection is a writable stream it emits all the events which are emitted by writable streams

`error`

Emitted when the client breaks the WebSocket protocol, the length of the message it too big or the structure of a received message has an invalid json structure when the host is set in `object` mode.

`message`

Emitted when the WebSocket host receives a message from the client and the host is set in `text` or `binary` mode. The callback function has an object as a parameter with 2 attributes `data`, the content of the message, and `type`, the type of the message which can be `binary` or `text`.

### <a name="ws-channel"/> WebSocket Channel

The object that groups a set of connections. This is useful for sending messages to a group of connections in a better way than the `.broadcast()` method of the WebSocket host. WebSocket channel is an event emitter, see [`events`](http://nodejs.org/api/events.html) core module for more details. To access the connections bound to the channel the `.connections` property should be used. This is an array, which should not be mutated to prevent any undesired behavior.

#### <a name="ws-channel-bind"/> .bind(connection)

connection: WebSocket Connection Instance

Adds the connection to the channel. Emits `bind` event with the `connection` as parameter. Returns current instance, so calls can be chained.

#### <a name="ws-channel-unbind"/> .unbind(connection)

connection: WebSocket Connection Instance

Removes the connection from the channel. The connection remains alive. Emits `unbind` event with `connection` as parameter. Returns current instance, so calls can be chained.

#### <a name="ws-channel-close"/> .close()

Drops all the connections from the channel and removes the channel from the WebSocket host. Channels are automatically closed if there are no bound connections. Emits `close` event with no parameters.

#### <a name="ws-channel-broadcast"/> .broadcast([event, ]data[, filter])

event: string

data: string or buffer

filter: function(connection: object, index: number, connection: array[objects])

Same as the WebSocket host `.broadcast()` method, but is applied to the connections of the channel. `filter` use should be minimized for high performance. Emits `broadcast` event with `event` and / or `data` as parameters. Returns current instance, so calls can be chained.

## <a name="client-api"/> Client Simple API

simpleS provide a simple API for creating HTTP and WS clients:

```js
var client = simples.client();
```

Now (version 0.7.0), it's quite primitive and provide only some methods to create HTTP requests and WS connections, but in the near future it will contain something more and will become a real rich-featured HTTP client with the current phylosophy of simplicity. Read more below about the how to make and handle HTTP requests and WS connections.

### <a name="client-api-http"/> HTTP Request

`client.request(method, location[, options])`

method: 'del', 'get', 'head', 'post' or 'put'

location: string

options: object

To create a HTTP request provide the method, the location and optionally some options. The options are an object which can contain HTTP or HTTPS specific request configuration, which is the same as the options provided for [`http.request`](http://nodejs.org/api/http.html#http_http_request_options_callback) or [`https.request`](http://nodejs.org/api/https.html#https_https_request_options_callback). To add more options the request has `.config(options)` method, note that this method must be called synchronously when the request is created, the options can not be set when the request is already sent. All requests are writable streams so the data is written with the streams API, but also has `.send(data[, replacer, space])` which is the same as the method used in the Connection Interface. The requests emit two events:

`response` - when the server response is received and response headers are ready (one argument, the response),

`body` - when the full response body is received (two arguments, the response and the body)

```js
var request = client.request('get', 'http://localhost/');

request.config({
    headers: {
        'X-Requested-With': 'simpleS'
    }
}):

request.on('response', function (response) {
    // Application logic
}).on('body', function (response, body) {
    // Application logic
});
```

For convenience, there are shortcut methods to make different types of requests:

`client.del(location[, options])`

`client.get(location[, options])`

`client.head(location[, options])`

`client.post(location[, options])`

`client.put(location[, options])`

For streaming data the following structures can be used:

```js
// Streaming to the request
anyStream.pipe(client.post('http://localhost/post'));

// Streaming from the request
client.get('http://localhost/get').response.pipe(anyOtherStream);

// Streaming to and from the request
anyStream.pipe(client.put('http://localhost/put')).response.pipe(anyOtherStream);
```

Every request has a `response` property which is a data stream without any special properties and which will emit data when the underlaying response stream will be ready.

### <a name="client-api-ws"/> WS Connection

`client.ws(location[, mode, options])`

location: string

mode: 'binary', 'object' or 'text'

options: object

To create a WS connection provide the location, communication mode or some additional options. The location may be prefixed with `http://` or `ws://` protocols (or with their secure versions `https://` and `wss://`), both methods will be processed in the same way. The communication mode may have the following values: `text`, `binary` or `object`, by default is `text`, to ensure a correct communication it should match with the mode in which the server is set. The options are an object which can contain HTTP or HTTPS specific request configuration, which is the same as the options provided for [`http.request`](http://nodejs.org/api/http.html#http_http_request_options_callback) or [`https.request`](http://nodejs.org/api/https.html#https_https_request_options_callback).

```js
var connection = client.ws('ws://localhost/echo', {
    headers: {
        'X-Requested-With': 'simpleS'
    }
});

connection.on('open', function () {
    // Application logic
}).on('message', function (message) {
    // Application logic
});
```

## <a name="browser-api"/> Browser Simple API

To have access to the simpleS client-side API it is necessary to add

```html
<script src="/simples.js"></script>
```

in the HTML code, this JavaScript file will provide a simple API for AJAX requests and WebSocket connections, also a simplified implementation of Node.JS event emitter, which is used mostly internally but is also available to use in the result applications.

### <a name="browser-api-ajax"/> AJAX (Asynchronous JavaScript and XML)

`simples.ajax(url, params[, method])`

url: string

params: object

method: 'delete', 'get', 'head', 'post' or 'put'

`simples.ajax()` will return an object which will create an XMLHttpRequest to the provided url, will send the needed parameters using the methods DELETE, GET (default), HEAD, POST or PUT. This object has 3 methods to attach listeners for error, progress and success events, which are named with the respective events. The AJAX request can also be aborted by the `.stop()` method.

```js
var request = simples.ajax('/', {
    user: 'me',
    password: 'ok'
}, 'post').error(function (code, description) {
    // Application logic
}).progress(function () {
    // Application logic
}).success(function (response) {
    // Application logic
});

// Somewhere else to stop the request
request.stop();
```

### <a name="browser-api-ee"/> EE (Event Emitter)

`simples.ee()`

`simples.ee()` is a simplified and a slightly modified implementation of Node.JS event emitter in the browser, which would be useful to create new objects or to inherit in object constructors. See [`events`](http://nodejs.org/api/events.html) core module for more details. Implemented methods:

`.emit(event[, data, ...])` - triggers an event with some specific data.

`.addListener(event, listener)`, `.on(event, listener)`, `.once(event, listener)` - create listeners for the events, `.once()` creates one time listener, emit `newListener` event.

`.removeListener(event, listener)` - remove a specific listener for an event, emit `removeListener` event.

`.removeAllListeners([event])` - remove all the listeners for a specific event or remove all the listeners for all the events.

### <a name="browser-api-ws"/> WS (WebSocket)

`simples.ws(url[, options])`

url: string

options: object

`simples.ws()` will return an object which will create an WebSocket connection to the provided url using the needed protocols, will switch automatically to `ws` or `wss` (secured) WebSocket protocols depending on the HTTP protocol used, secured or not. In the `options` parameter can be set the communication mode and the used protocols, the configuration must match on the client and the server to ensure correct data processing. `simples.ws()` is an event emitter and has the necessary methods to handle the listeners like Node.JS does, but on the client-side, note that `.emit()` method does not send data it just triggers the event, this is useful to instantly execute some actions on the client or for debugging the behavior of the WebSocket connection.

```js
var socket = simples.ws('/', {
    mode: 'text',
    protocols: ['echo'],
}).on('message', function (message) {
    this.send('Hello World');
});
```

#### <a name="browser-api-ws-management"/> Socket Management

`simples.ws()` has 2 methods for starting/restarting or closing the WebSocket connection:

`.open()` - opens the WebSocket connection when needed, this method is automatically called with `simples.ws()` or when the connection is lost.

`.close()` - closes the WebSocket connection.

##### <a name="browser-api-ws-events"/> Events

`message` - default event received in `binary` and `text` mode or in `object` mode if the incoming message could not be parsed, the callback function has one parameter, the received data.

`error` - triggered when an error appears, the callback function has one parameter, the message of the error.

`open` - triggered when the WebSocket connection is opened, the callback function has no parameters. All data which will be sent before this event will be stashed and sent when the connection is ready.

`close` - triggered when the WebSocket connection is closed, the callback function has no parameters.

#### <a name="browser-api-ws-modes"/> Data Management

Based on the third parameter in `simples.ws()` the communication with the server can be made in `binary`, `text` or `object` mode, `.send()` method is very robust, it will send data even if the connection is down, it will try to create a new connection to the server and send the message, below are examples of receiving and sending data in these modes:

##### Receiving data in `binary` or `text` mode

```js
socket.on('message', function (message) {
    // Application logic
    // use message.data and message.type
});
```

##### Receiving data in `object` mode

```js
socket.on('event', function (data) {
    // Application logic
    // use data
});
```

##### Sending data in `binary` or `text` mode

```js
socket.send(data);
```

##### Sending data in `object` mode

```js
socket.send(event, data);
```