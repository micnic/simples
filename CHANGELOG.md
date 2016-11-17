## 0.8.8
- Fix big WebSocket frames parsing
- Fix possible server crash by sending invalid WebSocket frames

## 0.8.7
- Fix client WebSocket connection creation
- Fix dynamic HTTP host removal

## 0.8.6
- Added virtual hosts defined with wild cards, websocket host included
- Added `host.data`
- Added `connection.use()` and `connection.unuse()` methods
- Improve websocket message broadcasting
- Improved internal code reutilization

## 0.8.5
- Fixed `simples.server` not being defined
- Now port argument will overwrite port property in server or mirror options
- Removed limitation for error routes to use only 404, 405 and 500 errors
- Added possibility to trigger defined error routes using the `estatus` event of the host

## 0.8.4
- Added `start` and `stop` events for server and mirror instances
- Fixed default session store to be compliant to the specs described in the docs
- Fixed default session clean up
- Throw error when mirror is on the same port with the main server instead of silent fail
- Improve restart functional for server and mirror instances
- Added some improved tests

## 0.8.3
- Add `serve` event when the host cache is ready
- Fix `connection.cache()` max age option checking
- Fix WS channel `.broadcast()` with simple modes

## 0.8.2
- Fix incorrect HTTP host configuration

## 0.8.1
- Reveal `.connections` for WS host and channel in the public docs
- Fix streams to work properly in node >0.12 versions
- Fix rendering in WebSocket connection
- Fix middleware removing

## 0.8.0
- Added Mirrors
- No more HTTP + HTTPS functional, use Mirrors instead
- Improved Client API request piping
- Improved QS parser to force array values
- Fixed render listeners creation
- Fixed websocket connection keep alive process in node >0.12 versions
- Added `timeout` option for HTTP and WS hosts

## 0.7.6
- Add `connection.cache()` method
- Fix importer to be optional in host routing when the listener is a string

## 0.7.5
- Update recache dependency for bug fixing

## 0.7.4
- Expose connection session to middlewares
- Added `simples.server()` for consistency
- `connection.keep()` will always set 0 timeout for invalid timeout value
- Added options to `host.serve()` for configuring the cache
- Moved cache and mime to external dependencies

## 0.7.3
- Improved template engine capabilities
- Fixed WebSocket limit for received data
- Fixed possible crash on WebSocket errors
- Small docs fixes

## 0.7.2
- Fixed implementation of routes with functions as importer parameter
- Improved performance for session keys generation

## 0.7.1
- Improved ws pong frame creation
- Improved performance for broadcasting data in websocket host and channel with filter
- Changed the way errors are emitted in non-TTY environment
- Improved routing process by removing an unnecessary checking step
- Moved routing process to be after all middlewares are executed
- Fixed some bugs related to CORS and websocket channel closing

## 0.7.0
- Add support for node.js 0.12 and io.js 1.x
- Implemented `simples.client`
- Disabled response compression by default
- Modified `connection.ip` to be `net.socket.address()` content
- Added `connection.data`
- Removed `referers` from HTTP host configuration as it's not so useful
- Added more options for CORS in host configuration
- Use plain parser when no other parser is valid for request parsing
- Simplified parsing API for `json` and `urlencoded` data
- Improved internal request routing and static file caching
- Replaced `type` option, `raw` and `advanced` modes from WebSocket configuration with `binary`, `text` and `object` modes
- Added separated accepted origins for WebSocket configuration
- Improved client-side code
- Improved examples
- Fixed documention errors
- Bug fixes

## 0.6.6
- Fixed and improved documentation to be up-to-date with the code
- Rewritten the client-side to wrap the code inside a closure
- Improved the client-side code
- Improved the search of the dynamic routes

## 0.6.5
- Fixed documentation about routes with render and importer
- Improved requests routing
- Fixed crash because of cache.destroy()
- Fixed crash because of ws socket receiving null data

## 0.6.4
- Improved server's commands execution
- Improved some internal functional related to websockets
- Improved connection preparation
- Fixed server crash because of possible incorect request body
- Fixed incorrect cache reading

## 0.6.3
- Fixed HTTPS content serving
- Implement a better synchronisation between HTTP and HTTPS servers

## 0.6.2
- Fixed routes which rendered views
- Fixed cache root reading
- Added importer functional for `connection.render()`
- Fixed channels container structure
- Improved internal structure
- Documentation fixes

## 0.6.1
- Fixed default session store crash
- Fixed `Last-Modified` header to have value compliant the HTTP standard
- Added `Last-Modified` header for cached directories
- Reworked the server instance creation
- Some documentation fixes

## 0.6.0
- Improved cookies and langs parsers
- Revealed `connection.request` and `connection.response` in the public docs
- Removed session for static content
- Implemented `connection.log()`
- Removed `host.log` in favor of `connection.log`
- Now session stores should manage expired sessions
- Fixed incorect session cookie expire time

## 0.5.9
- Modified error handling for the server and hosts
- Improved internal structure
- Fixed configuration copy

## 0.5.8
- Implemented new API for HTTP connection parsing using `.parse()` method
- Removed `connection.body` and `connection.files` in favor of `connection.parse()`
- Improvements for WS messages creation
- Improved HTTP request parsers
- Adjusted some implementation inaccuracy to the documentation
- Documentation updates
- Adapted host configuration to the new request parsing API
- Improved internal structure
- Small bufixes

## 0.5.7
- Implemented filtered compression by content type
- Improved ws client simple API
- Added `.link()` method for defining relations with other locations
- Removed `.length()` method because of possible unexpected behavior with compression
- Fixed incorrect multipart data attaching to the connection object

## 0.5.6
- Improved client-side API
- Improved connection API to return headers values, status code
- Added the possibility to remove headers from the response
- Implemented session store
- Removed the need in session secret key
- Added prefered type of compression
- Added `.length()` method to define or get the content length header
- Fixed static directory routing
- Internal structure improvements

## 0.5.5
- Improved dynamic routes searching
- Improved general routing performance
- Added `*` wildcard character to dynamic routes to match any string
- Added `.close()` method for the connection interface as an synonym for `.end()`
- Small bugfixes

## 0.5.4
- Fixed `DELETE` requests routing
- Changed configuration for the HTTP and the WS hosts
- Improved internal structure and global processes, in special sessions

## 0.5.3
- Fixed session data applying
- Improved cache behavior
- Improved internal session process
- Improved cookies applying

## 0.5.2
- Fixed CORS content providing
- Small internal structure impromevents

## 0.5.1
- Improved configuration for http host and ws host
- Added session cookies protection
- Added `connection.keep()`
- Some internal fixes and improvements

## 0.5.0
- Added callback to simples instance
- Improved internal structure
- Improved request routing
- Fixed advanced routing bugs
- Fixed some WS API issues

## 0.4.9
- Improved request parsing, added parsing for json data
- Parsed data is now stored in `connection.body`
- Fixed bugs related to dynamic caching and cache accesing
- Improved client-side API

## 0.4.8
- Implemented static server behavior for serving index.html if present for subdirectories
- Fixed 500 error for request to subdirectories when no callback is defined in `.serve()` method
- Fixed new behavior for sending WebSocket protocol header for Google Chrome 30
- Fixed behavior of client-side WS API on Firefox when the message size is too big

## 0.4.7
- API clean up, removed `.open()`, `.close()` methods for HTTP and WS hosts
- Added `.config()` method for WS host
- Improved logger, added configurable stream
- Renamed configuration names for HTTP and WS hosts (some changes may still be made here)
- Fixed WebSocket parsing when receiving a bunch of frames
- Other small bugfixes

## 0.4.6
- Fixed POST requests behavior
- Made that `.host()` method will create or return an existing host or the main host
- Documented `.route()` method as another way to create routes

## 0.4.5
- Added logger functionality
- Improved WebSocket unmasking
- Improved dynamic cache functionality
- Fixed missing host header that could break down the server
- Fixed error 404 routing

## 0.4.4
- Added routes for PUT and DELETE http methods
- Added `.status()` method for http connection
- Added `files` parameter for static files directory callback
- Added Node.JS event emitter implementation on client-side as `simples.ee`
- Fixed bug related to advanced routing
- Fixed `.drain()` streaming on error
- Fixed auxiliar server in HTTPS server pair WebSocket handling
- Improved dynamic caching
- Improved `.config()` method of http host by adding session time to live
- Improved `.drain()` method by adding parameters for setting the type of the content
- Improved the WebSocket channel creation
- Improved general error emitting
- Improved WebSocket handshake
- Improved internal structure

## 0.4.3
- Changed the internal log system
- Added a placeholder for render method
- `.render()` method now always imports connection object
- Added `.config()` method and removed `.accept()` and `.referer()` methods for http host

## 0.4.2
- Bugfixes
- Some improvements in code structure
- Improved documentation

## 0.4.1
- Improved dynamic caching
- Changed the behavior of pair HTTP + HTTPS servers
- Optimized routing
- Optimized WebSocket parser
- Added `connection.protocol`
- Fixed a lot of small bugs

## 0.4.0
- New template engine connection rules
- Multiple routes apply / remove
- Added shorthand for template rendering
- Added binary data in advanced mode
- Fixed a WebSocket connection bug with sending data
- Fixed crash on WebSocket close

## 0.3.9
- Made some optimizations
- Added `.ip` and `.path` to connection
- Fixed a rare bug in WebSocket with big data
- Fixed the bug with template engine connection
- Added `.leave()` method to host instances

## 0.3.8
- Fixed session in WebSocket
- Improved the internal organization of sessions

## 0.3.7
- Added CHANGELOG.md
- Combined request and response interfaces in connection interface

## 0.3.6
- Defined new template engine connection rules
- Improved DOCUMENTATION.md

## 0.3.5
- Added named parameters
- Removed `server.js`, combined functional with `index.js`

## 0.3.4
- Reorganized internal structure
- WebSocket channel made event emitter

## 0.3.3
- Added HTTPS support
- Some bugfixes

## 0.3.2
- Made the static files cache dynamic
- Some bugfixes

## 0.3.1
- Added static files cache
- Some bugfixes

## 0.3.0
- Better session mechanics
- Improved WebSocket channel
- Added referer blocking

## 0.2.9
- Added WebSocket channel
- Global improvements

## 0.2.8
- Added callback for directories with static files
- Some good improvements

## 0.2.7
- Fixed template engine connection bug
- Fixed POST data parser

## 0.2.6
- Improved tests
- Some good improvements

## 0.2.5
- Added template engine connection
- Fixed session timeout

## 0.2.4
- Just bugfixes and optimizations

## 0.2.3
- Added client-side API
- Added raw / advanced mode for WebSocket

## 0.2.2
- Just bugfixes and API improments

## 0.2.1
- Added virtual hosting

## 0.2.0
- Changed mime structure
- Improved API

## 0.1.9
- More WebSocket API changes
- Global improvements

## 0.1.8
- Some API changes for WebSocket

## 0.1.7
- Added sessions

## 0.1.6
- Added CORS support

## 0.1.5
- Removed `.download()` method from response interface
- Fixed bug with string used as parameter to `.send()` method

## 0.1.4
- Bugfixes
- Added new interactive tests

## 0.1.3
- Just bugfixes and optimizations

## 0.1.2
- Added DOCUMENTATION.md
- Renamed `.getStatic()` method to `.serve()`
- Removed own implementation of compress stream, replaced with zlib streams
- Added `.send()` method to response interface

## 0.1.1
- Error routing modified, moved to `.error()` method

## 0.1.0
- Removed a memory leak
- Added a POST request parser

## 0.0.9
- Added LICENSE
- Small improvements

## 0.0.8
- Added `.body` attribute to request interface

## 0.0.7
- Improved internal structure

## 0.0.6
- Removed the bug with one possible instance
- Modified the structure of simpleS prototype constructor

## 0.0.5
- Tried to remove the bug with one possible instance
- Modified `mime.js` structure
- Modified routing structure

## 0.0.4
- Added `.getOrigin()` and `.getProtocols()` methods to WebSocket connection

## 0.0.3
- Fixed WebSocket host choice
- Added default configuration for WebSocket host

## 0.0.2
- Modified `.start()` method to be more asynchronous

## 0.0.1
- First public release