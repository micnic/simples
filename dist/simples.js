"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function (f) {
	if ((typeof exports === "undefined" ? "undefined" : _typeof(exports)) === "object" && typeof module !== "undefined") {
		module.exports = f();
	} else if (typeof define === "function" && define.amd) {
		define([], f);
	} else {
		var g;if (typeof window !== "undefined") {
			g = window;
		} else if (typeof global !== "undefined") {
			g = global;
		} else if (typeof self !== "undefined") {
			g = self;
		} else {
			g = this;
		}g.simples = f();
	}
})(function () {
	var define, module, exports;module = { exports: exports = {} };
	/* eslint-env browser */
	'use strict';

	var WS = function () {
		function WS(location, options) {
			_classCallCheck(this, WS);

			var advanced = false;
			var protocol = 'ws';
			var protocols = [];

			// Set default connection to the root
			if (typeof location !== 'string') {
				location = '/';
			}

			// Get the protocol name
			if (window.location.protocol === 'https:') {
				protocol += 's';
			}

			// Add the current host to the location
			location = location.replace(/^\//, window.location.host + '/');

			// Add the protocol to the location
			location = location.replace(/^(?:.+:\/\/)?/, protocol + '://');

			// Check for provided options
			if (options && (typeof options === "undefined" ? "undefined" : _typeof(options)) === 'object') {

				// Check for advanced mode
				advanced = options.advanced === true;

				// Get the WebSocket subprotocols
				if (Array.isArray(options.protocols)) {
					protocols = options.protocols.filter(function (element) {
						return typeof element === 'string';
					});
				} else if (typeof options.protocols === 'string') {
					protocols.push(options.protocols);
				}
			}

			// Define public WebSocket properties
			this.data = {};

			// Define private WebSocket properties
			this._advanced = advanced;
			this._events = Object.create(null);
			this._location = location;
			this._opening = false;
			this._protocols = protocols;
			this._queue = [];
			this._socket = null;
			this._started = false;

			// Open the WebSocket
			this.open();
		}

		// Close the WebSocket


		_createClass(WS, [{
			key: "close",
			value: function close() {

				// Close the WebSocket only if it is started
				if (this._started) {
					this._socket.close();
					this._started = false;
				}

				return this;
			}

			// Dispatch an event

		}, {
			key: "emit",
			value: function emit(event) {
				var _this = this;

				for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
					args[_key - 1] = arguments[_key];
				}

				// Throw the error if there are no listeners for error event
				if (event === 'error' && !this._events.error) {
					if (args[0] instanceof Error) {
						throw args[0];
					} else {
						throw Error('Uncaught, unspecified "error" event.');
					}
				}

				// Check if the event has listeners
				if (this._events[event]) {
					this._events[event].forEach(function (listener) {
						listener.apply(_this, args);
					});

					return true;
				}

				return false;
			}

			// Remove one event listener, all listeners of an event, or all of them

		}, {
			key: "off",
			value: function off(event, listener) {

				if (event && listener) {
					if (this._events[event]) {

						var index = this._events[event].indexOf(listener);

						if (index >= 0) {
							this._events[event].splice(index, 1);
						}
					}
				} else if (event) {
					if (this._events[event]) {
						delete this._events[event];
					}
				} else {
					this._events = Object.create(null);
				}
			}

			// Append listener for an event

		}, {
			key: "on",
			value: function on(event, listener) {

				var listeners = this._events[event];

				// Create the event listeners container if it is missing
				if (!listeners) {
					listeners = this._events[event] = [];
				}

				// Push the listener to the event listeners container
				if (typeof listener === 'function') {
					listeners.push(listener);
				}

				return this;
			}

			// Append one time listener for an event

		}, {
			key: "once",
			value: function once(event, listener) {
				var _this2 = this;

				var onceListener = function onceListener() {
					for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
						args[_key2] = arguments[_key2];
					}

					listener.apply(_this2, args);
					_this2.off(event, onceListener);
				};

				// Append the listener
				this.on(event, onceListener);
			}

			// Open or reopen the WebSocket connection

		}, {
			key: "open",
			value: function open() {
				var _this3 = this;

				// Set the opening flag
				this._opening = true;

				// Close the previously used socket
				this.close();

				// Initialize the WebSocket
				this._socket = new WebSocket(this._location, this.protocols);

				// Listen for socket close
				this._socket.onclose = function (event) {
					_this3._started = false;
					_this3.emit('close', event);
				};

				// Catch socket errors
				this._socket.onerror = function (error) {
					_this3._started = false;
					_this3.emit('error', error);
				};

				// Listen for incoming messages
				this._socket.onmessage = function (event) {

					var message = event;

					// Parse and emit the received data
					if (_this3._advanced) {
						try {
							message = JSON.parse(message.data);
						} catch (error) {
							_this3.emit('error', Error('Can not parse message'));
						} finally {
							if (message) {
								_this3.emit(message.event, message.data);
							} else {
								_this3.emit('message', message);
							}
						}
					} else {
						_this3.emit('message', message);
					}
				};

				// Listen for socket opening
				this._socket.onopen = function () {

					// Set the started flag
					_this3._started = true;
					_this3._opening = false;

					// Emit the open event of the socket
					_this3.emit('open');

					// Send the messages from the queue
					while (_this3._queue.length) {
						_this3._socket.send(_this3._queue.shift());
					}
				};

				return this;
			}

			// Send data via the WebSocket connection

		}, {
			key: "send",
			value: function send(event, data, callback) {

				// Prepare the data
				if (this._advanced) {
					data = JSON.stringify({
						data: data,
						event: event
					});
				} else {
					data = event;
				}

				// Check for open socket and send data
				if (this._started) {
					try {
						this._socket.send(data);
					} catch (error) {
						this.emit('error', error);
						this._queue.push(data);
						this.open();
					}
				} else {

					// Push the message to the end of the queue
					this._queue.push(data);

					// If connection is down then open a new one
					if (!this.opening) {
						this.open();
					}
				}

				// Listen for event response in advanced mode if callback provided
				if (this._advanced && typeof callback === 'function') {
					this.once(event, callback);
				}

				return this;
			}
		}]);

		return WS;
	}();

	module.exports = {
		ws: function ws(location, options) {

			return new WS(location, options);
		}
	};
	return module.exports;
});
