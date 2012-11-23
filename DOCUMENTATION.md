```javascript
var simples = require('simples');
```

## New simpleS instance
`simples(port)`

port: number

simpleS needs only the port number and it sets up a HTTP server on this port.

```javascript
var server = simples(80);
```

or

```javascript
var server = new simples(80);
```

## Server management
### Starting and restarting
`.start(port, callback)`

port: number

callback: function(0)

Start listening for requests on the provided port. If the server is already started,  then simpleS will restart the server and will listen on the new provided port. Warning: this method is asynchronous, do not call it in a `.start()` or `.stop()` method synchronous sequence.

```javascript
server.start(80, function () {
    // Application logic
});
```
### Stopping
`.stop(callback)`

callback: function(0)

Stop the server. Warning: this method is asynchronous, do not call it in a `.start()` or `.stop()` method synchronous sequence.

```javascript
server.stop(function () {
    // Application logic
});
```
## CORS configuration
`.accept(origins)`

origins: array of strings

simpleS provide a very simple way to accept cross-origin requests. It will automatically check the origin of the request and if it is in the list then it will response positively. By default the server will accept requests only from the host origin. To accept requests from any origin use `['*']`. Example:
```javascript
server.accept(['null', 'localhost', 'http://www.example.com:80']);
```
## Routing
### GET requests
`.get(route, callback)`

route: string

callback: function(2)

Listen for get requests and uses the callback function with request and response as parameters. Warning: `route` is case sensitive.

```javascript
server.get('/', function (request, response) {
    // Application logic
});
```

### POST requests
`.post(route, callback)`

route: string

callback: function(2)

Listen for post requests and uses the callback function with request and response as parameters. Warning: `route` is case sensitive.

```javascript
server.post('/', function (request, response) {
    // Application logic
});
```

### All requests
`.all(route, callback)`

route: string

callback: function(2)

Listen for both GET and POST requests and uses the callback function with request and response as parameters. Warning: `route` is case sensitive.

```javascript
server.all('/', function (request, response) {
    // Application logic
});
```

### Static files
`.serve(path)`

path: string

`path` is the local path to a folder that contains static files (for example: css and js files), this folder will serve as the root folder for the server. simpleS will return response status 304 (Not Modified) if the files have not been changed since last visit of the client. Only one folder should be used to server static files, if more `.serve()` methods will be called only the last will be used to serve static files. The folder with static files can contain other folders, their content will be also served. The provided path must be relative to the current working directory. Warning: the names of static files are case sensitive.

```javascript
server.serve('root');
```

### Error routes
`.error(code, callback)`

code: number

callback: function(2)

Use the callback function with request and response as parameters for errors that can have place. Only one callback function can be used for a specific error code, if more `.error()` methods will be called for the same error code only the last will be used for routing. Possible values for error codes are: 404 (Not Found), 405 (Method Not Allowed) and 500 (Internal Server Error).

```javascript
server.error(404, function (request, response) {
    // Application logic
});
```

### Request interface
The first parameter provided in callbacks for routing requests is an object that contains data about the current request. Example:
```javascript
{
    body: '',
    connection: {
        ip: '127.0.0.1',
        port: 50505
    },
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

#### body
The content of the body of the request, for GET requests it is empty, for POST request it will contain plain data, parsed data is contained in `request.query`.
#### connection
Data about the current connection, object containing the remote ip address and the port.
#### cookies
An object that contains the cookies provided by the client.
#### files
An object that contains files send using POST method with multipart/form-data content type.
#### headers
An object that contains the HTTP headers of the request.
#### langs
An array of strings that represents languages accepted by the client in the order of their relevance.
#### method
The HTTP method of the request.
#### query
The object that contains queries from both GET and POST methods.
#### session
A container used to keep important data on the server-side, the clients have access to this data using the `_session` cookie.
#### url
The url of the request split in components like href, path, pathname, query as object and query as string (search).
### Response interface
The second parameter provided in callbacks for routing requests is a writable stream that defines the data sent to the client. It has the next methods:
#### .cookie(name, value, config)
name: string

value: string

config: object

Sets the cookies sent to the client, providing a name, a value and an object to configure the expiration time, to limit the domain and the path and to specify if the cookie is http only. Can be used multiple times, but before `.write()` method. Example:
```javascript
response.cookie('user', 'me', {
    expires: new Date(new Date().valueOf() + 3600000), // or maxAge: 3600000, default is undefined
    path: '/', // Default is the root of the server
    domain: 'localhost', // Default is the domain of the server
    httpOnly: false, // Default is true
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
#### .type(type)
type: string

Sets the type of the content of the response. Default is 'html'. Should be used before the `.write()` method. Should be used only once. Example:
```javascript
response.type('html');
```
#### .write(data)
data: string or buffer

Writes data to the response stream. Should be ended with `.end()` method. Example:
```javascript
response.write('Hello');
```
#### .end(data)
data: string or empty

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
## WebSocket
### WebSocket host
`.ws(path, config, callback)`

path: string

config: object

callback: function(1)

Listen for WebSocket connections. For security reasons origins and protocols should be provided in the config parameter, the length of the message can be limited, default is 1MB. The callback function comes with the connection as parameter.

```javascript
server.ws('/', {
    messageMaxLength: 1024,
    origins: ['null'],
    protocols: ['chat']
}, function (connection) {
    // Application logic
});
```
### WebSocket connection
The object that represents the current WebSocket connection. The WebSocket connection is an event emitter. It has the next methods:
#### .origin
The origin of the WebSocket connection.
#### .protocols
The array of protocols of the WebSocket connection.
#### .request
The request interface, same as for GET and POST requests, which is described above.
#### .socket
The TCP socket used to maintain this WebSocket connection.
#### .send(data)
data: any value except undefined

Sends a message to the client. If `data` is a buffer then the sent message will be of binary type, else - text type, arrays, booleans, numbers and objects are stringified.
#### .broadcast(data, filter)
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