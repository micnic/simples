/* eslint strict: ["error", "function"] */
window.simples = (function () {
	'use strict';

	// Transform object to encoded URI keys and values
	function encodeURIData(data) {

		var result = [];

		// Loop through the data elements and encode the keys and the values
		result = Object.keys(data).map(function (element) {

			var key = encodeURIComponent(element),
				value = encodeURIComponent(data[element]);

			return key + '=' + value;
		});

		return result.join('&');
	}

	// AJAX microframework
	var ajax = function (url, data, method) {

		var hash = url.indexOf('#'),
			json = false,
			that = this,
			xhr = new XMLHttpRequest();

		// Define private properties for simples.ajax
		Object.defineProperties(this, {
			listeners: {
				value: {}
			},
			xhr: {
				value: xhr
			}
		});

		// Default error listener
		this.listeners.error = function () {
			throw Error('Error listener not defined');
		};

		// Default success listener
		this.listeners.success = function () {
			throw Error('Success listener not defined');
		};

		// Set method to lower case for comparison
		if (typeof method === 'string') {
			method = method.toLowerCase();
		}

		// Accept only DELETE, GET, HEAD, POST and PUT methods, defaults to get
		if (!/^delete|get|head|post|put$/.test(method)) {
			method = 'get';
		}

		// Cut off the fragment identifier
		if (hash >= 0) {
			url = url.substr(0, hash);
		}

		// Process data
		if (method === 'get' || method === 'head') {

			// Check if the URL contains query string
			if (url.indexOf('?') < 0) {
				url += '?';
			} else {
				url += '&';
			}

			// Add the data to the URL string
			url += encodeURIData(data);
			data = null;
		}

		// Open the XMLHttpRequest
		xhr.open(method.toUpperCase(), url);

		// Prepare data to be sent
		if (data instanceof HTMLFormElement) {
			data = new FormData(data);
		} else if (data && typeof data === 'object') {

			// Check if data contains objects inside
			json = Object.keys(data).some(function (key) {
				return typeof data[key] === 'object';
			});

			// Stringify data
			if (Array.isArray(data) || json) {
				data = JSON.stringify(data);
				xhr.setRequestHeader('Content-Type', 'application/json');
			} else {
				data = encodeURIData(data);
			}
		}

		// Send the data throught the XMLHttpRequest
		xhr.send(data);

		// Listen for changes in the state of the XMLHttpRequest
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4 && xhr.status < 400) {
				that.listeners.success(xhr.responseText, xhr.status);
			} else if (xhr.readyState === 4) {
				that.listeners.error(xhr.status, xhr.statusText);
			}
		};
	};

	// Set the error listener
	ajax.prototype.error = function (listener) {

		// Check if the listener is a function
		if (typeof listener === 'function') {
			this.listeners.error = listener;
		}

		return this;
	};

	// Abords the ajax transmission
	ajax.prototype.stop = function () {
		this.xhr.abort();
	};

	// Set the success listener
	ajax.prototype.success = function (listener) {

		// Check if the listener is a function
		if (typeof listener === 'function') {
			this.listeners.success = listener;
		}

		return this;
	};

	// Client-side simplified Node.JS event emitter implementation
	var ee = function () {

		// Define listeners object
		Object.defineProperty(this, 'listeners', {
			value: {},
			writable: true
		});
	};

	// Append listener for an event
	ee.prototype.addListener = function (event, listener) {

		var listeners = this.listeners[event];

		// Check if more listeners exist for this event
		if (!listeners) {
			listeners = this.listeners[event] = [];
		}

		// Push the listener to the event listeners array
		if (typeof listener === 'function') {
			listeners.push(listener);
		}

		// Emit the new listener event
		if (this.listeners.newListener && event !== 'newListener') {
			this.emit('newListener', event, listener);
		}

		return this;
	};

	// Trigger the event with the data
	ee.prototype.emit = function (event) {

		var args = Array.apply(Array, arguments).slice(1),
			that = this;

		// Throw the error if there are no listeners for error event
		if (event === 'error' && !this.listeners.error) {
			if (args[0] instanceof Error) {
				throw args[0];
			} else {
				throw Error('Uncaught, unspecified "error" event.');
			}
		}

		// Check if the event has listeners
		if (this.listeners[event]) {
			this.listeners[event].forEach(function (listener) {
				listener.apply(that, args);
			});
		}

		return this;
	};

	// Shortcut for addListener
	ee.prototype.on = ee.prototype.addListener;

	// Append one time listener
	ee.prototype.once = function (event, listener) {

		var that = this;

		// Prepare the one time listener
		function onceListener() {
			listener.apply(that, arguments);
			that.removeListener(event, onceListener);
		}

		// Append the listener
		this.on(event, onceListener);

		return this;
	};

	// Delete all listeners of an event or all listeners of all events
	ee.prototype.removeAllListeners = function (event) {

		var that = this;

		// If event is provided remove all its listeners
		if (event) {

			// Remove each event listener individually
			while (this.listeners[event].length) {
				this.removeListener(event, this.listeners[event][0]);
			}

			// Remove the event listener container for the current event
			delete this.listeners[event];
		} else if (!arguments.length) {

			// Remove all listeners for all events
			Object.keys(this.listeners).forEach(function (event) {
				that.removeAllListeners(event);
			});

			// Reset the listeners container
			this.listeners = {};
		}

		return this;
	};

	// Delete specific listener
	ee.prototype.removeListener = function (event, listener) {

		var index;

		// Check if the event has listeners and remove the needed one
		if (this.listeners[event] && typeof listener === 'function') {

			// Get the index of the listener
			index = this.listeners[event].indexOf(listener);

			// Check if the listener was found
			if (index >= 0) {

				// Remove the found listener
				this.listeners[event].splice(index, 1);

				// Emit the remove listener event
				if (this.listeners.removeListener) {
					this.emit('removeListener', event, listener);
				}
			}
		}

		return this;
	};

	// WebSocket microframework
	var ws = function (location, options) {

		var mode = 'text',
			protocol = 'ws',
			protocols = [];

		// Call event emitter in this context
		ee.call(this);

		// Set default connection to the root
		if (typeof location !== 'string') {
			location = '/';
		}

		// Get the protocol name
		if (window.location.protocol === 'https:') {
			protocol += 's';
		}

		// Add the current host to the location if the leading slash was found
		location = location.replace(/^\//, window.location.host + '/');

		// Add the protocol to the location
		location = location.replace(/^(?:.+:\/\/)?/, protocol + '://');

		// Set the default configuration
		if (!options || typeof options !== 'object') {
			options = {
				mode: mode,
				protocols: protocols
			};
		} else {

			// Set the binary or object mode
			if (/^binary|object$/.test(options.mode)) {
				mode = options.mode;
			}

			// Get the WebSocket subprotocols
			if (Array.isArray(options.protocols)) {
				protocols = options.protocols.filter(function (element) {
					return typeof element === 'string';
				});
			} else if (typeof options.protocols === 'string') {
				protocols.push(options.protocols);
			}
		}

		// Define private properties for simples.ws
		Object.defineProperties(this, {
			location: {
				value: location
			},
			mode: {
				value: mode
			},
			opening: {
				value: false,
				writable: true
			},
			protocols: {
				value: protocols
			},
			queue: {
				value: []
			},
			socket: {
				value: null,
				writable: true
			},
			started: {
				value: false,
				writable: true
			}
		});

		// Open the WebSocket
		this.open();
	};

	// Inherit from simples.ee
	ws.prototype = Object.create(ee.prototype, {
		constructor: {
			value: ws
		}
	});

	// Close the WebSocket
	ws.prototype.close = function () {

		// Close the WebSocket only if it is started
		if (this.started) {
			this.socket.close();
			this.started = false;
		}

		return this;
	};

	// Open or reopen the WebSocket socket
	ws.prototype.open = function () {

		var that = this;

		// Set the opening flag
		this.opening = true;

		// Close the previously used socket
		this.close();

		// Initialize the WebSocket
		this.socket = new WebSocket(this.location, this.protocols);

		// Listen for socket close
		this.socket.onclose = function () {
			that.started = false;
			that.emit('close');
		};

		// Catch socket errors
		this.socket.onerror = function () {
			that.started = false;
			that.emit('error', Error('Disconnected from ' + this.location));
		};

		// Listen for incoming messages
		this.socket.onmessage = function (event) {

			var message;

			// Parse and emit the received data
			if (that.mode === 'object') {
				try {
					message = JSON.parse(event.data);
					that.emit(message.event, message.data);
				} catch (error) {
					that.emit('error', Error('Can not parse message'));
					that.emit('message', event);
				}
			} else {
				that.emit('message', event);
			}
		};

		// Listen for socket open
		this.socket.onopen = function () {

			// Set the started flag
			that.started = true;
			that.opening = false;

			// Emit the open event of the socket
			that.emit('open');

			// send the messages from the queue
			while (that.queue.length) {
				that.socket.send(that.queue.shift());
			}
		};

		return this;
	};

	// Send data via the WebSocket connection
	ws.prototype.send = function (event, data) {

		// Prepare the data
		if (this.mode === 'object') {
			data = JSON.stringify({
				event: event,
				data: data
			});
		} else {
			data = event;
		}

		// Check for open socket and send data
		if (this.started) {
			try {
				this.socket.send(data);
			} catch (error) {
				this.queue.push(data);
				this.open();
			}
		} else {

			// Push the message to the end of the queue
			this.queue.push(data);

			// If connection is down then open a new one
			if (!this.opening) {
				this.open();
			}
		}

		return this;
	};

	return {
		ajax: function (url, data, method) {
			return new ajax(url, data, method);
		},
		ee: function () {
			return new ee();
		},
		ws: function (location, options) {
			return new ws(location, options);
		}
	};
})();