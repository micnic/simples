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