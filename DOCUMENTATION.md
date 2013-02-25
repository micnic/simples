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
var server = new simples(80);
```


or


```javascript
var server = simples(80); // simpler
```


To set up a HTTPS server the options object is needed with `key` and `cert` attributes, these will be the paths to the `.pem` files.


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

callback: function(0)

Start listening for requests on the provided port. If the server was started before, simpleS will get sessions from the `.sessions` file if they exist or they have valid structure. If the server is already started,  then simpleS will restart the server and will listen on the new provided port. Can have an optional callback. All connection in simpleS are kept alive and the restart can take few seconds, for closing alive http and ws connections. While restarting, no new connection will be accepted but existing connections will be still served.


```javascript
server.start(80, function () {
    // Application logic
});
```


### Stopping


`.stop([callback])`

callback: function(0)

Stop the server. The existing sessions are saved to the `.sessions` file for further access. Can have an optional callback. All connection in simpleS are kept alive and the closing can take few seconds, for closing alive http and ws connections. While closing, no new connection will be accepted but existing connections will be still served. Calling `SIGINT` (`ctrl + c`) will cause the manual close execution, this is made for graceful server close, if no need in graceful closing then `SIGINT` should be called twice.


```javascript
server.stop(function () {
    // Application logic
});
```


### Virtual Hosting


`.host(name)`

name: string

simpleS can serve multiple domains on the same server and port, using `.host()` method it is simple to specify which host should use which routes. By default, simpleS has the main host which will route all existent routes of the simpleS instance, this is vital for one host on server or when it is needed a general behavior for incoming requests. Routing methods explained below are applicable on simpleS instance, for the main host, and on this method to define different hosts. Example:


```javascript
server.host('example.com');
```


#### Host Management


`.open()`

Make the host active, this method is called automatically when a new host is created.

`.close()`

Closes all the child WebSocket hosts and make the host inactive.

`.destroy()`

Close the host and removes it from the server. Can not destroy the main host.


### CORS (Cross-Origin Resource Sharing) and Referers


`.accept([arguments])`

arguments: list of strings

simpleS provide a very simple way to accept cross-origin requests. It will automatically check the origin of the request and if it is in the list then it will response positively. By default, the server will accept requests only from the current host. To accept requests from any origin use `'*'`, if this parameter is used as the first parameter then all next origins are rejected. `'null'` is used for local file system origin. This method is applicable on each host independently (see Virtual Hosting). These limitations will work for `HTTP` `GET` and `POST` request and even for `WebSocket` requests. Example:


```javascript
server.accept('null', 'localhost', 'example.com'); // Will accept requests only from these 3 hosts

server.accept('*', 'example.com'); // Will accept requests from all hosts except 'example.com'
```


`.referer([arguments])`

arguments: list of strings

To block other domains from using host's static resources like images, css or js files, it is possible to define a list of accepted referers. By default, the server will response to all request from different host referers. To a accept only specific referers, their list should be defined as parameters to this method, to accept all referers except some specific the first parameter should be `*`. The current host should not be added in the list, it is served anyway. The server will respond with error 404 to unacceptable referers. Example:


```javascript
server.referer('*', 'example.com'); // will respond to all referers except 'example.com'

server.referer('example.com', 'test.com'); // Will respond only to these 2 referers
```


### Templating


`.engine(engine, render)`

engine: object

render: string

simpleS provide a simple way to use template engines for response rendering, for this it is necessary to define the needed template engine and its rendering method, if the method is not defined then the engine itself or its `.render()` method, if available, will be used to render the response. Recommended template engine: [simpleT](http://micnic.github.com/simpleT/). This method is applicable on each host independently (see Virtual Hosting). Example:


```javascript
var noopEngine = {
    render: function (string) {
        console.log(string);
        return string;
    }
};

server.engine(noopEngine); // or server.engine(noopEngine, 'render');

// Another example
var noopRender = function (string) {
    console.log(string);
    return string;
}

server.engine(noopRender);
```


## Routing


All the methods described below are applicable on each host independently (see Virtual Hosting). All route paths are case sensitive to exclude possible unexpected behavior.


### GET Requests


`.get(route, callback)`

route: string

callback: function(2)

Listen for get requests and uses the callback function with request and response as parameters.


```javascript
server.get('/', function (request, response) {
    // Application logic
});
```


### POST Requests


`.post(route, callback)`

route: string

callback: function(2)

Listen for post requests and uses the callback function with request and response as parameters.


```javascript
server.post('/', function (request, response) {
    // Application logic
});
```


### All Requests


`.all(route, callback)`

route: string

callback: function(2)

Listen for both `GET` and `POST` requests and uses the callback function with request and response as parameters, this is useful for defining general behavior for both types of requests.


```javascript
server.all('/', function (request, response) {
    // Application logic
});
```


### Static Files


`.serve(path[, callback])`

path: string

callback: function(2)

`path` is the local path to a folder that contains static files (for example: images, css or js files), this folder will serve as the root folder for the server. simpleS will return response status 304 (Not Modified) if the files have not been changed since last visit of the client. Only one folder should be used to serve static files, if more `.serve()` methods will be called only the last will be used to serve static files. The folder with static files can contain other folders, their content will be also served. The provided path must be relative to the current working directory. The `callback` parameter is the same as for `GET` and `POST` requests, but it is triggered only when the client accesses the root of a subfolder of the folder with static files, this parameter is optional. All files are dynamically cached for better performance.


```javascript
server.serve('root', function (request, response) {
    // Application logic
});
```


### Error Routes


`.error(code, callback)`

code: number

callback: function(2)

Use the callback function with request and response as parameters for errors that can have place. Only one callback function can be used for a specific error code, if more `.error()` methods will be called for the same error code only the last will be used for routing. Possible values for error codes are: 404 (Not Found), 405 (Method Not Allowed) and 500 (Internal Server Error).


```javascript
server.error(404, function (request, response) {
    // Application logic
});
```


### Request Interface


The first parameter provided in callbacks for routing requests is an object that contains data about the current request. Example:


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
    langs: [
        'ro',
        'en'
    ],
    method: 'GET',
    query: {},
    session: {},
    url: {
        search: '',
        query: {},
        pathname: '/',
        path: '/',
        href: '/'
    }
}
```


#### Request Object Attributes


`.body`

The content of the body of the request, for `GET` requests it is empty, for `POST` request it will contain plain data, parsed data is contained in `request.query` or `request.files`.

`.cookies`

An object that contains the cookies provided by the client.

`.files`

An object that contains files send using POST method with `multipart/form-data` content type.

`.headers`

An object that contains the HTTP headers of the request.

`.langs`

An array of strings that represents languages accepted by the client in the order of their relevance.

`.method`

The HTTP method of the request, it can be `GET`, `HEAD` or `POST` for usual requests, but can have a different value on error `405`.

`.query`

The object that contains queries from both GET and POST methods, it is recommended to use different names for queries from both methods, if there are two queries with the same name then the GET query will be overwritten.

`.session`

A container used to keep important data on the server-side, the clients have access to this data using the `_session` cookie sent automatically, the `_session` cookie has a value of 8 `0-9a-zA-Z` characters which will ensure security for `218.340.105.584.896` values. This is a getter and the session is initialized only when it is called, this is made for more performance.

`.url`

The url of the request split in components like href, path, pathname, query as object and query as string (search), see `url` core module for more details.


### Response Interface


The second parameter provided in callbacks for routing requests is a writable stream that defines the data sent to the client. It has the next methods:


#### .cookie(name, value, attributes)


name: string

value: string

attributes: object

Sets the cookies sent to the client, providing a name, a value and an object to configure the expiration time, to limit the domain and the path and to specify if the cookie is http only. Can be used multiple times, but before `.write()` method. Example:


```javascript
response.cookie('user', 'me', {
    expires: new Date(new Date().valueOf() + 3600000), // or maxAge: 3600000, Set the expiration time of the cookie
    path: '/path/', // Path of the cookie, should be defined only if it is different from the root, the first slash may be omitted, simpleS will add it
    domain: 'localhost', // Domain of the cookie, should be defined only if it is different from the current host
    secure: false, // Set if the cookie is secured, used by HTTPS
    httpOnly: false, // Set if the cookie can not be changed from client-side
});
```


#### .header(name, value)


name: string

value: string

Sets the header of the response. Usually simpleS manages the headers of the response by itself setting the cookies, the languages, the content type or when redirecting the client, in these cases the method `.header()` should not be used. Example:


```javascript
response.header('ETag', '0123456789');
```


#### .lang(language)


language: string

Sets the language of the response. Should be used before the `.write()` method. Should be used only once. Example:


```javascript
response.lang('ro');
```


#### .redirect(path)


path: string

Redirects the client to the provided path. Should not be used with the other methods except `.cookie()`. Example:


```javascript
response.redirect('/index');
```


#### .type(type[, override])


type: string

override: boolean

Sets the type of the content of the response. Default is 'html'. By default uses one of 100 content types defined in [mime.js](https://github.com/micnic/simpleS/blob/master/utils/mime.js), which can be edited to add mode content types. Should be used only once and before the `.write()` method. If the content type header is not set correctly or the exact value of the type is known it is possible to override using the second parameter with true value and setting the first parameter as a valid content type. The second parameter is optional. If the required type is unknown `application/octet-stream` will be applied. Example:


```javascript
response.type('html');
```


#### .write(data)


data: buffer or string

Writes data to the response stream. Should be ended with `.end()` method. Example:


```javascript
response.write('Hello');
```


#### .end([data])


data: buffer, string or empty

If data is provided it calls the `.write()` method and ends the response. Example:


```javascript
response.end('World');
```


#### .send(data)


data: any value except undefined

Writes preformatted data to the response stream and ends the response, useful for sending JSON format. Arrays, booleans, numbers and objects are stringified. Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once. Example:


```javascript
response.send(['Hello', 'World']);
```


#### .drain(path)


path: string

Get the content of the file located on the specified path and write it to the response. Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once. Example:


```javascript
response.drain('path/to/index.html');
```


#### .render([arguments])


arguments: arguments for the template engine

Renders the response using the template engine, arguments will be those necessary for the template engine defined by the host. Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once. Example:


```javascript
response.render('HelloWorld');
```


## WebSocket


The WebSocket host is linked to the current or the main HTTP host (see Virtual Hosting).


### WebSocket Host


`.ws(path, config, callback)`

path: string

config: object

callback: function(1)

Create WebSocket host and listen for WebSocket connections. For security reasons only requests from the current host or local file system origins are accepted, to accept requests from another locations the `.accept()` method from the simpleS instance should be used. Also, for additional security or logic separation, protocols should be provided in the config parameter, they should match on the server and on the client, the length of the message can be limited too, default is 1MiB, the value is defined in bytes. The connection can be used in raw and advanced mode. The advanced mode allows an event based communication over the WebSocket connection, while the raw mode represents a low level communication, default is advanced mode. The callback function comes with the connection as parameter.


```javascript
var echo = server.ws('/', {
    length: 1024,
    protocols: ['', 'echo'],
    raw: true
}, function (connection) {
    // Application logic
});
```


#### .open(config)


config: object

Restarts the WebSocket host with new configuration. Example:


```javascript
echo.start({
    length: 512,
    protocols: ['', 'echo']
});
```


#### .close()


Stops the WebSocket host. Will close all existing connections and will not receive new connections.


#### .destroy()


Will stop the current WebSocket host and will remove it from the WebSocket hosts list.


#### .broadcast([event, ]data[, filter])


event: string

data: string or buffer

filter: function(3)

Sends a message to all connected clients. Clients can be filtered by providing the `filter` parameter, equivalent to `Array.filter()`. Example:


```javascript
echo.broadcast('HelloWorld', function (element, index, array) {
    return element.protocols.indexOf('echo') >= 0; // Will send the message to clients that use "chat" as a subprotocol
});
```


#### .channel(name)


name: string

Opens a new channel with the provided name. The channel is bound to the WebSocket host. See WebSocket Channel for more information.


### WebSocket Connection


The object that represents the current WebSocket connection. The WebSocket connection is an event emitter and has some attributes from request interface to handle needed data from the handshake request.


#### WebSocket Connection Members


`.cookies`

See Request Interface `.cookies`

`.headers`

See Request Interface `.headers`

`.langs`

See Request Interface `.langs`

`.protocols`

The array of protocols of the WebSocket connection.

`.session`

See Request Interface `.session`

`.send([event, ]data)`
event: string

data: any value except undefined

Sends a message to the client. In advanced mode the event parameter is needed for sending data. If `data` is a buffer then the sent message will be of binary type, else - text type, arrays, booleans, numbers and objects are stringified.


#### WebSocket Connection Events


`message`

Emitted when the server receives a message from the client.

`close`

Emitted when the connection is closed.


### WebSocket Channel


The object that groups a set of connections. This is useful for sending messages to a group of connections in a better way than the `.broadcast()` method of the WebSocket host. WebSocket channel is an event emitter.


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

filter: function(3)

Same as the WebSocket host `.broadcast()` method, but is applied to the connections of this channel. Emits `broadcast` event with `event` and / or `data` as parameters.


## Client-Side Simple API


To have access to the simpleS client-side API it is necessary to add

```html
<script src="/simples/client.js"></script>
```

in the HTML code, this JavaScript file will provide a simple API for AJAX requests and WebSocket connections, which are described below.


### AJAX (Asynchronous JavaScript and XML)


`simples.ajax(url, params[, method])`

url: string

params: object

method: string

`simples.ajax()` will return an object which will create an XMLHttpRequest to the provided url, will send the needed parameters using the methods GET (default) or POST. This object has 3 methods to attach listeners for error, progress and success events, which are named with the respective events. The AJAX request can also be aborted by the `.stop()` method. Example:


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

protocols: array

raw: boolean

`simples.ws()` will return an object which will create an WebSocket connection to the provided host using the needed protocols. If raw parameter is set to true then this connection will use a low level communication with the server, else the connection will use a event based communication with the server, which is more intuitive, by default is advanced mode. Example:


```javascript
var socket = simples.ws('/', ['echo'], true).on('message', function (message) {
    this.send('Hello World');
});
```


#### Socket Management


`simples.ws()` has 2 methods for starting/restarting or closing the WebSocket connection:

`.open(host, protocols)` - starts or restarts the WebSocket connection when needed, can be used for recycling the WebSocket connection an to connect to another host, this method is automatically called with `simples.ws()` or when the connection is lost

`.close()` - closes the WebSocket connection


#### Listeners Management
`simples.ws()` is an event emitter and has the necessary methods to handle the listeners like Node.JS does, but on the client-side:

`.emit(event[, data])` - triggers locally an event, does not send data to the server, is useful for triggering instantly the event on the client or for debugging

`.addListener(event, listener)`, `.on(event, listener)`, `.once(event, listener)` - create listeners for the events, `.once()` creates one time listener

`.removeAllListeners([event])`, `.removeListener(event listener)` - remove the listeners for events or all listeners for a specific event


##### Events


`message` - default event received in raw mode or in advanced mode if the incoming message could not be parsed, the callback function has one parameter, the received data

`error` - triggered when an error appears, the callback function has one parameter, the message of the error

`close` - triggered when the WebSocket connection is closed, the callback function has no parameters


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

