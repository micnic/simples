***simpleS is under active development, the API may change from version to version, it is highly recommended to read the documentation of the current version as there may me be some radical changes***

```javascript
var simples = require('simples');
```

# New simpleS Instance

`simples(port[, options])`

port: number

options: object

simpleS needs only the port number and it sets up a HTTP server on this port.

```javascript
var server = simples(80);
```

To set up a HTTPS server the options object is needed with `key` and `cert` attributes, these will be the paths to the `.pem` files. The requests on HTTPS are always listen on port 443. Automatically, with the HTTPS server a HTTP server is created which will redirect all requests to the HTTPS.

```javascript
var server = simples(443, {
    key: 'path/to/key.pem',
    cert: 'path/to/certificate.pem'
});
```

## Server Management

### Starting and Restarting

`.start(port[, callback])`

port: number

callback: function()

Start listening for requests on the provided port. If the server was started before, simpleS will get sessions from the `.sessions` file if they exist or they have a valid structure. If the server is already started,  then simpleS will restart the server and will listen on the new provided port. Can have an optional callback. All connection in simpleS are kept alive and the restart can take few seconds, for closing alive http and ws connections. While restarting, no new connection will be accepted but existing connections will be still served. This method is called automatically when a new simpleS instance is created, it is not needed to call it explicitly on server creation. The purpose of this method is to provide a way to switch port or to start a stopped simpleS instance.

```javascript
server.start(80, function () {
    // Application logic
});
```

### Stopping

`.stop([callback])`

callback: function()

Stop the server. The existing sessions are saved to the `.sessions` file for further access. Can have an optional callback. All connection in simpleS are kept alive and the closing can take few seconds, for closing alive http and ws connections. While closing, no new connection will be accepted but existing connections will be still served. The purpose of this method is to provide a way for closing the server and save the existing session for future use.

```javascript
server.stop(function () {
    // Application logic
});
```

### Virtual Hosting

`.host(name)`

name: string

simpleS can serve multiple domains on the same server and port, using `.host()` method it is simple to specify which host should use which routes. By default, simpleS has the main host which will route all existent routes of the simpleS instance, this is vital for one host on server or when it is needed a general behavior for incoming requests. Routing methods explained below are applicable on simpleS instance, for the main host, and on this method to define different hosts.

```javascript
var host = server.host('example.com');
```

#### Host Management

`.open()`

Make the host active, this method is called automatically when a new host is created, it is not needed to call it explicitly on host creation.

`.close()`

Closes all the child WebSocket hosts and make the host inactive.

`.destroy()`

Close the host and removes it from the server. Can not destroy the main host, for the main host all routes will be cleaned as it would be a new created host.

### CORS (Cross-Origin Resource Sharing) and Referers

`.accept(host[, ...])`

host: string

simpleS provide a very simple way to accept cross-origin requests. It will automatically check the origin of the request and if it is in the list then it will response positively. By default, the server will accept requests only from the current host. To accept requests from any origin use `'*'`, if this parameter is used as the first parameter then all next origins are rejected. `'null'` is used for local file system origin. This method is applicable on each host independently (see Virtual Hosting). These limitations will work for `HTTP` `GET` and `POST` request and even for `WebSocket` requests.

```javascript
server.accept('null', 'localhost', 'example.com'); // Will accept requests only from these 3 hosts

server.accept('*', 'example.com'); // Will accept requests from all hosts except 'example.com'
```

`.referer(host[, ...])`

host: string

To block other domains from using host's static resources like images, css or js files, it is possible to define a list of accepted referers. By default, the server will response to all request from different host referers. To a accept only specific referers, their list should be defined as parameters to this method, to accept all referers except some specific the first parameter should be `*`. The current host should not be added in the list, it is served anyway. The server will respond with error 404 to unacceptable referers.

```javascript
server.referer('*', 'example.com'); // will respond to all referers except 'example.com'

server.referer('example.com', 'test.com'); // Will respond only to these 2 referers
```

### Templating

`.engine(engine)`

engine: object

To render templates it is necessary to define the needed template engine which has a `.render()` method. The rendering method should accept 2 parameters, `source` and `imports`, `source` should be a string that defines the path to the templates, `imports` may be an optional parameter and should be an object containing data to be injected in the templates. The templates are rendered using the `.render()` method of Connection Interface. If the template engine does not correspond to these requirements then a wrapper object should be applied. This method is applicable on each host independently (see Virtual Hosting). Recommended template engine: [simpleT](http://micnic.github.com/simpleT).

```javascript

var noopEngine = {
    render: function (source) {
        console.log(source);
        return source;
    }
};

server.engine(noopEngine);

// Wrapped unsupported template engine example
var unsupportedEngine = {
    renderFile: function (imports, source) {
        console.log(source);
        return source;
    }
};

server.engine({
    render: function (source, imports) {
        unsupportedEngine.renderFile(imports, source);
    }
});
```

## Routing

All the methods described below are applicable on each host independently (see [Virtual Hosting](#virtual-hosting)). All route paths are case sensitive and should contain only paths without queries to exclude possible unexpected behavior and to ensure improved performance, undesired data will be cut off. All routes are relative to the host root and may not begin with `/`, simpleS will ignore it anyway. The routes may be fixed or can contain named parameters. Fixed routes are fast and simple, while the second ones are more flexible and handy in complex applications. The named parameters in the advanced routes are mandatory, if at least one component of the route is absent in the url then the url is not routed.

```javascript
'user/john/action/thinking'; // Fixed route

'user/:user/action/:action'; // Advanced route with named parameters

/*
    This route will match this request url:

    /user/mary/action/cooking

    with parameters:

    {
        user: 'mary',
        action: 'cooking'
    }
*/
```

### All Requests

`.all(route, result)`

route: array[strings] or string

result: string or function(connection)

Listen for both `GET` and `POST` requests and uses a callback function with connection as parameter or a string for rendering (see `Connection.render()`), this is useful for defining general behavior for both types of requests. This method is prioritized against `.get()` and `.post()` methods.

### GET Requests

`.get(route, result)`

route: array[strings] or string

result: string or function(connection)

Listen for get requests and uses a callback function with connection as parameter or a string for rendering (see `Connection.render()`).

### POST Requests

`.post(route, result)`

route: array[strings] or string

result: string or function(connection)

Listen for post requests and uses a callback function with connection as parameter or a string for rendering (see `Connection.render()`).

### Error Routes

`.error(code, result)`

code: 404, 405 or 500

result: string or function(connection)

Listen for errors that can have place and uses a callback function with connection as parameter or a string for rendering (see `Connection.render()`). Only one method call can be used for a specific error code, if more `.error()` methods will be called for the same error code only the last will be used for routing. Possible values for error codes are: 404 (Not Found), 405 (Method Not Allowed) and 500 (Internal Server Error). If no error routes are defined, then the default ones will be used.

#### Examples for `.all()`, `.get()`, `.post()` and `.error()` methods:

```javascript
server.all('/', function (connection) {
    // Application logic
});

server.get([
    '/',
    '/index'
], function (connection) {
    // Application logic
});

server.error(404, 'not_found.ejs');

server.post([
    '/',
    '/index'
], 'index.ejs');
```

### Static Files

`.serve(path[, callback])`

path: string

callback: function(connection)

`path` is the local path to a folder that contains static files (for example: images, css or js files), this folder will serve as the root folder for the server. simpleS will return response status 304 (Not Modified) if the files have not been changed since last visit of the client. Only one folder should be used to serve static files, if more `.serve()` methods will be called only the last will be used to serve static files. The folder with static files can contain other folders, their content will be also served. The provided path must be relative to the current working directory. The `callback` parameter is the same as for `GET` and `POST` requests, but it is triggered only when the client accesses the root of a sub folder of the folder with static files, this parameter is optional. All files are dynamically cached for better performance.

```javascript
server.serve('root', function (connection) {
    // Application logic
});
```

### Removing Routes

`.leave([type, route])`

type: 'all', 'error', 'get', 'post' or 'serve'

route: 404, 405, 500, array[strings] or string

Removes a specific route, a set od routes, a specific type of routes or all routes. If the type and the route is specified, then the route or the set of routes of this type are removed. If only the type is specified, then all routes of this type will be removed. If no parameters are specified, then the routes will be set in their default values. Routes should be specified in the same way that these were added.

### Connection Interface

The parameter provided in callbacks for routing requests is an object that contains data about the current request and the data sent to the client. The connection is a writable stream, see [`stream`](http://nodejs.org/api/stream.html) core module for more details.

```javascript
{
    body: '',
    cookies: {
        user: 'me',
        pass: 'password'
    },
    files: {},
    headers: {
        host: 'localhost',
        'user-agent': 'myBrowser',
        accept: 'text/html',
        'accept-language': 'ro;q=0.8,en;q=0.6',
        'accept-encoding': 'gzip, deflate',
        cookie: 'user=me; pass=password'
    },
    host: 'localhost',
    ip: '127.0.0.1',
    langs: [
        'ro',
        'en'
    ],
    method: 'GET',
    query: {},
    params: {},
    path: '/'
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

#### .body

The content of the body of the request, for `GET` requests it is empty, for `POST` request it will contain plain data, parsed data is contained in `connection.query` or `connection.files`.

#### .cookies

An object that contains the cookies provided by the client.

#### .files

An object that contains files sent using POST method with `multipart/form-data` content type.

#### .headers

An object that contains the HTTP headers of the request.

#### .host
The hostname from the `Host` header.

#### .ip

The remote ip address of the request.

#### .langs

An array of strings that represents languages accepted by the client in the order of their relevance.

#### .method

The HTTP method of the request, it can be `GET`, `HEAD` or `POST` for usual requests, but can have a different value on error `405`.

#### .params

The object that contains named parameters from the route. This object is only populated when the request url match a specific route with named parameters. The named parameters represents strings that are limited only by `/` or the end of the url.

#### .path

The pathname of the url of the request.

#### .query

The object that contains queries from both GET and POST methods, it is recommended to use different names for queries from both methods, if there are two queries with the same name then the GET query will be overwritten.

#### .session

A container used to keep important data on the server-side, the clients have access to this data using the `_session` cookie sent automatically, the `_session` cookie has a value of 16 `0-9a-zA-Z` characters which will ensure security for `4.76 * 10 ^ 28` values. This is a getter and the session is initialized only when it is called, this is made for more performance.

#### .url

The url of the request split in components, see [`url`](http://nodejs.org/api/url.html) core module for more details.

#### .cookie(name, value[, attributes])

name: string

value: string

attributes: object

Sets the cookies sent to the client, providing a name, a value and an object to configure the expiration time, to limit the domain and the path and to specify if the cookie is http only. To make a cookie to be removed on the client the expiration time should be set in `0`. Can be used multiple times, but before `.write()` method.

```javascript
connection.cookie('user', 'me', {
    expires: 3600,          // or maxAge: 3600, Set the expiration time of the cookie in seconds
    path: '/path/',         // Path of the cookie, should be defined only if it is different from the root, the first slash may be omitted, simpleS will add it
    domain: 'localhost',    // Domain of the cookie, should be defined only if it is different from the current host
    secure: false,          // Set if the cookie is secured, used by HTTPS
    httpOnly: false,        // Set if the cookie can not be changed from client-side
});
```

#### .header(name, value)

name: string

value: string or array[strings]

Sets the header of the response. Usually simpleS manages the headers of the response by itself setting the cookies, the languages, the content type or when redirecting the client, in these cases the method `.header()` should not be used. If the header already exists in the list then its value will be replaced. To send multiple headers with the same name the value should be an array of strings.

```javascript
connection.header('ETag', '0123456789');
```

#### .lang(language)

language: string

Sets the language of the response. Should be used before the `.write()` method. Should be used only once.

```javascript
connection.lang('ro');
```

#### .redirect(path[, permanent])

path: string

permanent: boolean

Redirects the client to the provided path. If the redirect is permanent then the second parameter should be set as true. For permanent redirects the code `302` is set, for temporary redirects - `301`. Should not be used with the other methods except `.cookie()`, which should be placed before.

```javascript
connection.redirect('/index', true);
```

#### .type(type[, override])

type: string

override: boolean

Sets the type of the content of the response. Default is 'html'. By default uses one of 100 content types defined in [mime.js](https://github.com/micnic/simpleS/blob/master/utils/mime.js), which can be edited to add mode content types. Should be used only once and before the `.write()` method. If the content type header is not set correctly or the exact value of the type is known it is possible to override using the second parameter with true value and setting the first parameter as a valid content type. The second parameter is optional. If the required type is unknown `application/octet-stream` will be applied.

```javascript
connection.type('html');
```

#### .send(data[, replacer, space])

data: any value

replacer: array[numbers or strings] or function(key, value)

space: number of string

Writes preformatted data to the response stream and ends the response, implements the functionality of `JSON.stringify()` for arrays, booleans, numbers and objects, buffers and strings are sent as they are. Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once.

```javascript
connection.send(['Hello', 'World']);
```

#### .drain(path)

path: string

Get the content of the file located on the specified path and write it to the response. Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once.

```javascript
connection.drain('path/to/index.html');
```

#### .render(source, imports)

source: string

imports: object

Renders the response using the template engine defined by the host in `.engine()` method (see Templating). Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once.

```javascript
connection.render('Hello <%= world %>', {
    world: 'World'
});
```

## WebSocket

The WebSocket host is linked to the current or the main HTTP host (see Virtual Hosting).

### WebSocket Host

`.ws(path, config, callback)`

path: string

config: object

callback: function(connection)

Create WebSocket host and listen for WebSocket connections. For security reasons only requests from the current host or local file system origins are accepted, to accept requests from another locations the `.accept()` method from the simpleS instance should be used. Also, for additional security or logic separation, protocols should be provided in the `config` parameter, they should match on the server and on the client, the length of the message can be limited too, default is 1MiB, the value is defined in bytes. The connection can be used in raw and advanced mode. The advanced mode allows an event based communication over the WebSocket connection, while the raw mode represents a low level communication, default is advanced mode. The callback function comes with the connection as parameter.

```javascript
var echo = server.ws('/', {
    length: 1024,
    protocols: ['', 'echo'],
    raw: true
}, function (connection) {
    // Application logic
});
```

#### .open([config, callback])

config: object

callback: function(connection)

Restarts the WebSocket host with new configuration and callback. The missing configuration parameters will not be changed. This method is called automatically when a new WebSocket host is created, it is not needed to call it explicitly on WebSocket host creation.

```javascript
echo.start({
    length: 512,
    protocols: ['', 'echo']
}, function (connection) {
    // Application logic
});
```

#### .close()

Stops the WebSocket host. Will close all existing connections and will not receive new connections.

#### .destroy()

Will stop the current WebSocket host and will remove it from the WebSocket hosts list.

#### .broadcast([event, ]data[, filter])

event: string

data: string or buffer

filter: function(element, index, array)

Sends a message to all connected clients. Clients can be filtered by providing the `filter` parameter, equivalent to `Array.filter()`.

```javascript
echo.broadcast('HelloWorld', function (element, index, array) {
    return element.protocols.indexOf('echo') >= 0; // Will send the message to clients that use "chat" as a sub protocol
});
```

#### .channel(name)

name: string

Opens a new channel with the provided name. The channel is bound to the WebSocket host. See WebSocket Channel for more information.

### WebSocket Connection

The object that represents the current WebSocket connection. The WebSocket connection is an event emitter, see [`events`](http://nodejs.org/api/events.html) core module for more details, and has some attributes from connection interface to handle needed data from the handshake request.

#### WebSocket Connection Members

`.cookies`

See Connection Interface `.cookies`.

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

The object that contains the queries from the handshake HTTP request.

`.session`

See Connection Interface `.session`.

`.url`

See Connection Interface `.url`.

`.close()`

Sends the last frame of the WebSocket connection and then closes the socket.

`.send([event, ]data)`
event: string

data: any value

Sends a message to the client. In advanced mode the event parameter is needed for sending data. If `data` is a buffer then the sent message will be of binary type, else - text type, arrays, booleans, numbers and objects are stringified.

#### WebSocket Connection Events

`message`

Emitted when the server receives a message from the client. The callback function has an object as a parameter with 2 attributes `data`, the content of the message,  and `type`, the type of the message which can be `binary` or `text`.

`close`

Emitted when the connection is closed. The callback function does not have any parameter.

### WebSocket Channel

The object that groups a set of connections. This is useful for sending messages to a group of connections in a better way than the `.broadcast()` method of the WebSocket host. WebSocket channel is an event emitter, see [`events`](http://nodejs.org/api/events.html) core module for more details.

#### .bind(connection)

connection: WebSocket Connection Instance

Adds the connection to the channel. Emits `bind` event with the `connection` as parameter.

#### .unbind(connection)

connection: WebSocket Connection Instance

Removes the connection from the channel. The connection remains alive. Emits `unbind` event with `connection` as parameter.

#### .close()

Drops all the connections from the channel and removes the channel from the WebSocket host. Channels are automatically closed if there are no bound connections. Emits `close` event with no parameters.

#### .broadcast([event, ]data[, filter])

event: string

data: string or buffer

filter: function(element, index, array)

Same as the WebSocket host `.broadcast()` method, but is applied to the connections of this channel. Emits `broadcast` event with `event` and / or `data` as parameters.

## Client-Side Simple API

To have access to the simpleS client-side API it is necessary to add

```html
<script src="simples.js"></script>
```

in the HTML code, this JavaScript file will provide a simple API for AJAX requests and WebSocket connections, which are described below.

### AJAX (Asynchronous JavaScript and XML)

`simples.ajax(url, params[, method])`

url: string

params: object

method: 'get' or 'post'

`simples.ajax()` will return an object which will create an XMLHttpRequest to the provided url, will send the needed parameters using the methods GET (default) or POST. This object has 3 methods to attach listeners for error, progress and success events, which are named with the respective events. The AJAX request can also be aborted by the `.stop()` method.

```javascript
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

### WS (WebSocket)

`simples.ws(host, protocols, raw)`

host: string

protocols: array[strings]

raw: boolean

`simples.ws()` will return an object which will create an WebSocket connection to the provided host using the needed protocols, will switch automatically to `ws` or `wss` (secured) WebSocket protocols depending on the HTTP protocol used, secured or not. If raw parameter is set to true then this connection will use a low level communication with the server, else the connection will use a event based communication with the server, which is more intuitive, by default is advanced mode.

```javascript
var socket = simples.ws('/', ['echo'], true).on('message', function (message) {
    this.send('Hello World');
});
```

#### Socket Management

`simples.ws()` has 2 methods for starting/restarting or closing the WebSocket connection:

`.open([host, protocols])` - starts or restarts the WebSocket connection when needed, can be used for recycling the WebSocket connection and to connect to another host, this method is automatically called with `simples.ws()` or when the connection is lost.

`.close()` - closes the WebSocket connection.

#### Listeners Management
`simples.ws()` is an event emitter and has the necessary methods to handle the listeners like Node.JS does, but on the client-side, see [`events`](http://nodejs.org/api/events.html) core module for more details:

`.emit(event[, data])` - triggers locally an event, does not send data to the server, is useful for triggering instantly the event on the client or for debugging.

`.addListener(event, listener)`, `.on(event, listener)`, `.once(event, listener)` - create listeners for the events, `.once()` creates one time listener.

`.removeAllListeners([event])`, `.removeListener(event listener)` - remove the listeners for events or all listeners for a specific event.

##### Events

`message` - default event received in raw mode or in advanced mode if the incoming message could not be parsed, the callback function has one parameter, the received data.

`error` - triggered when an error appears, the callback function has one parameter, the message of the error.

`close` - triggered when the WebSocket connection is closed, the callback function has no parameters.

#### Data Management

Based on the third parameter in `simples.ws()` the communication with the server can be made in advanced or raw mode, `.send()` method is very robust, it will send data even if the connection is down, it will try to create a new connection to the server and send the message, below are examples of receiving and sending data in these modes:

##### Receiving Data in Raw Mode

```javascript
socket.on('message', function (message) {
    // Application logic
});
```

##### Receiving Data in Advanced Mode

```javascript
socket.on(event, function (data) {
    // Application logic
});
```

##### Sending Data in Raw Mode

```javascript
socket.send(data);
```

##### Sending Data in Advanced Mode

```javascript
socket.send(event, data);
```