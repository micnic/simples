***simpleS is under active development, the API may change from version to version, it is highly recommended to read the documentation of the current version as there may me be some radical changes***
```javascript
var simples = require('simples');
```
## New simpleS Instance
`simples(port)`

port: number

simpleS needs only the port number and it sets up a HTTP server on this port.

```javascript
var server = new simples(80);
```
or
```javascript
var server = simples(80); // simpler
```
## Server Management
### Starting and Restarting
`.start(port[, callback])`

port: number

callback: function(0)

Start listening for requests on the provided port. If the server is already started,  then simpleS will restart the server and will listen on the new provided port. Can have an optional callback.

```javascript
server.start(80, function () {
    // Application logic
});
```
### Stopping
`.stop([callback])`

callback: function(0)

Stop the server. Can have an optional callback.

```javascript
server.stop(function () {
    // Application logic
});
```
### Virtual Hosting
`.host(name)`

name: string

simpleS can serve multiple domains on the same server and port, using `.host()` method it's simple to specify which host should use which routes. By default simpleS has the main host which will route all existent routes of the simpleS instance, this is vital for one host on server or when it is needed a general behavior for incoming requests. Routing methods explained below are applicable on simpleS instance, for the main host, and on this method to define different hosts. Example:
```javascript
server.host('example.com');
```
### CORS (Cross-Origin Resource Sharing)
`.accept([arguments])`

arguments: list of strings

simpleS provide a very simple way to accept cross-origin requests. It will automatically check the origin of the request and if it is in the list then it will response positively. By default the server will accept requests only from the host and local file system origins. To accept requests from any origin use `'*'`, if this parameter is used as the first parameter then all next origins are rejected. `'null'` is used for local file system origin. This method is applicable on the current or the main host (see Virtual Hosting). These limitations will work for HTTP GET and POST request and even for WebSocket requests. Example:
```javascript
server.accept('null', 'localhost', 'example.com');
```
### Templating
`.engine(engine)`

engine: object

simpleS provide a simple way to use template engine for response rendering, for this it is necessary to define the needed template engine, if it has the method `.render()` then it will be used, else the engine itself will be used to render the response. Example:
```javascript
var noopEngine = {
	render: function (string) {
		console.log(string);
		return string;
	}
};

server.engine(noopEngine);
```
## Routing
All the methods described below are applicable on the current or the main host (see Virtual Hosting).
### GET Requests
`.get(route, callback)`

route: string

callback: function(2)

Listen for get requests and uses the callback function with request and response as parameters. Warning: `route` is case sensitive.

```javascript
server.get('/', function (request, response) {
    // Application logic
});
```
### POST Requests
`.post(route, callback)`

route: string

callback: function(2)

Listen for post requests and uses the callback function with request and response as parameters. Warning: `route` is case sensitive.

```javascript
server.post('/', function (request, response) {
    // Application logic
});
```
### All Requests
`.all(route, callback)`

route: string

callback: function(2)

Listen for both GET and POST requests and uses the callback function with request and response as parameters,this is useful for defining general behavior for both types of requests. Warning: `route` is case sensitive.

```javascript
server.all('/', function (request, response) {
    // Application logic
});
```
### Static Files
`.serve(path)`

path: string

`path` is the local path to a folder that contains static files (for example: css and js files), this folder will serve as the root folder for the server. simpleS will return response status 304 (Not Modified) if the files have not been changed since last visit of the client. Only one folder should be used to server static files, if more `.serve()` methods will be called only the last will be used to serve static files. The folder with static files can contain other folders, their content will be also served. The provided path must be relative to the current working directory. Warning: the names of static files are case sensitive.

```javascript
server.serve('root');
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
#### .body
The content of the body of the request, for GET requests it is empty, for POST request it will contain plain data, parsed data is contained in `request.query`.
#### .cookies
An object that contains the cookies provided by the client.
#### .files
An object that contains files send using POST method with multipart/form-data content type.
#### .headers
An object that contains the HTTP headers of the request.
#### .langs
An array of strings that represents languages accepted by the client in the order of their relevance.
#### .method
The HTTP method of the request.
#### .query
The object that contains queries from both GET and POST methods.
#### .session
A container used to keep important data on the server-side, the clients have access to this data using the `_session` cookie.
#### .url
The url of the request split in components like href, path, pathname, query as object and query as string (search).
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
    path: '/path/', // Path of the cookie, should be defined only if it is diferent from the root, the first slash may be omitted, simpleS will add it
    domain: 'localhost', // Domain of the cookie, should be defined only if it is different from the current host
    httpOnly: false, // Set if the cookie can not be changed from client-side
});
```
#### .lang(language)
language: string

Sets the language of the response. Should be used before the `.write()` method. Should be used only once. Example:
```javascript
response.lang('ro');
```
#### .redirect(path)
path: string

Redirects the client to the provided path. Should not be used with the other methods. Example:
```javascript
response.redirect('/index');
```
#### .type(type[, override])
type: string

override: boolean

Sets the type of the content of the response. Default is 'html'. By default uses one of 100 content types defined in [mime.json](https://github.com/micnic/simpleS/blob/master/utils/mime.json), which can be edited to add mode content types. Should be used only once and before the `.write()` method. If the content type header is not set correctly or the exact value of the type is known it is possible to override using the second parameter with true value of this method and setting the first parameter as a valid content type. The second parameter is optional. Example:
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

Writes preformatted data to the response stream and ends the response, usually very useful for sending file content or JSON format. Arrays, booleans, numbers and objects are stringified. Should not be used with `.write()` or `.end()` methods, but `.write()` method can be used before. Should be used only once. Example:
```javascript
response.send(['Hello', 'World']);
```
#### .render([arguments])
arguments: arguments for the template engine

Renders the response using the template engine, arguments will be those necessary for the template engine. Example:
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

Create WebSocket host and listen for WebSocket connections. For security reasons only requests from the current host or local file system origins are accepted, to accept requests from another locations the `.accept()` method from the simpleS instance should be used. Also, for additional security or logic separation, protocols should be provided in the config parameter, by default no protocols are required, the length of the message can be limited too, default is 1MiB, the value is defined in bytes. The callback function comes with the connection as parameter.

```javascript
server.ws('/', {
    length: 1024,
    protocols: ['', 'echo']
}, function (connection) {
    // Application logic
});
```
### WebSocket Connection
The object that represents the current WebSocket connection. The WebSocket connection is an event emitter and has some attributes from request interface to handle needed data from the handshake request. It has the next attributes and methods:
#### .cookies
See Request Interface `.cookies`
#### .headers
See Request Interface `.headers`
#### .langs
See Request Interface `.langs`
#### .protocols
The array of protocols of the WebSocket connection.
#### .query
See Request Interface `.query`
#### .session
See Request Interface `.session`
#### .url
See Request Interface `.url`
#### .send(data)
data: any value except undefined

Sends a message to the client. If `data` is a buffer then the sent message will be of binary type, else - text type, arrays, booleans, numbers and objects are stringified.
#### .broadcast(data, [filter])
data: string or buffer

filter: function(3)

Sends a message to all connected clients. Clients can be filtered by providing the second parameter, equivalent to `Array.filter()`. Example:
```javascript
connection.broadcast('HelloWorld', function (element, index, array) {
    return element.getProtocols().indexOf('chat') >= 0; // Will send the message to clients that use "chat" as a subprotocol
});
```
The WebSocket connection has the next events:
#### message
Emitted when the server receives a message from the client.
#### close
Emitted when the connection is closed.
### Client-Side Simple API
To have access to the simpleS client-side API it is necessary to add `<script src="/simples/client.js"></script>` in the HTML code, this JavaScript file will provide a simple API for AJAX requests and WebSocket connections, which are described below.
#### AJAX (Asynchronous JavaScript and XML)
`simples.ajax(url, method, params)`

url: string

method: string

params: object

`simples.ajax()` will return an object which will create an XMLHttpRequest to the provided url and using the provided method and parameters. This object has 3 methods to attach listeners for error, progress and success events, which are named with the respective events. Example:
```javascript
simples.ajax('/', 'post', {
    user: 'me',
    password: 'ok'
}).error(function (response) {
    // Application logic
}).progress(function (response) {
    // Application logic
}).success(function (response) {
    // Application logic
});
```
#### WS (WebSocket)
`simples.ws(host, protocols, raw)`

host: string

protocols: array

raw: boolean

`simples.ws()` will return an object which will create an WebSocket connection to the provided host and protocols. If raw parameter is set to true then this connection will use a low level communication with the server, else the connection will use a event based communication with the server, which is more intuitive, by default raw is set to true. This object is an event emitter (has the folowing methods: .emit(), .addListener(), .on(), .once(), .removeAllListeners(), .removeListener()). To receive a message in raw mode `.on('message' function () {/*...*/})` should be used, for advanced mode `.on(EVENT, function () {/*...*/})` is used. To send data to the server the .send() method is used, in raw mode it should have only one parameter, the data, in advanced mode it should have two parameters, the event and the data. .emit() method is used to trigger the events locally, but not on the server, this is useful for triggering instantly the event on the client or for debugging. To close the WebSocket connection `.close()` method is used. Example:
```javascript
simples.ws('/', ['echo'], true).on('message', function (message) {
    this.send('Hello World');
});
```