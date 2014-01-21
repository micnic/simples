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