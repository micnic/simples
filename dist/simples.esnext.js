(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.simples = f()}})(function(){var define,module,exports;module={exports:(exports={})};
/* eslint-env browser */
'use strict';

class WS {

	constructor(location, options) {

		let advanced = false;
		let protocol = 'ws';
		let protocols = [];

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
		if (options && typeof options === 'object') {

			// Check for advanced mode
			advanced = (options.advanced === true);

			// Get the WebSocket subprotocols
			if (Array.isArray(options.protocols)) {
				protocols = options.protocols.filter((element) => {
					return (typeof element === 'string');
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
	close() {

		// Close the WebSocket only if it is started
		if (this._started) {
			this._socket.close();
			this._started = false;
		}

		return this;
	}

	// Dispatch an event
	emit(event, ...args) {

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
			this._events[event].forEach((listener) => {
				listener.apply(this, args);
			});

			return true;
		}

		return false;
	}

	// Remove one event listener, all listeners of an event, or all of them
	off(event, listener) {

		if (event && listener) {
			if (this._events[event]) {

				const index = this._events[event].indexOf(listener);

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
	on(event, listener) {

		let listeners = this._events[event];

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
	once(event, listener) {

		const onceListener = (...args) => {
			listener.apply(this, args);
			this.off(event, onceListener);
		};

		// Append the listener
		this.on(event, onceListener);
	}

	// Open or reopen the WebSocket connection
	open() {

		// Set the opening flag
		this._opening = true;

		// Close the previously used socket
		this.close();

		// Initialize the WebSocket
		this._socket = new WebSocket(this._location, this.protocols);

		// Listen for socket close
		this._socket.onclose = (event) => {
			this._started = false;
			this.emit('close', event);
		};

		// Catch socket errors
		this._socket.onerror = (error) => {
			this._started = false;
			this.emit('error', error);
		};

		// Listen for incoming messages
		this._socket.onmessage = (event) => {

			let message = event;

			// Parse and emit the received data
			if (this._advanced) {
				try {
					message = JSON.parse(message.data);
				} catch (error) {
					this.emit('error', Error('Can not parse message'));
				} finally {
					if (message) {
						this.emit(message.event, message.data);
					} else {
						this.emit('message', message);
					}
				}
			} else {
				this.emit('message', message);
			}
		};

		// Listen for socket opening
		this._socket.onopen = () => {

			// Set the started flag
			this._started = true;
			this._opening = false;

			// Emit the open event of the socket
			this.emit('open');

			// Send the messages from the queue
			while (this._queue.length) {
				this._socket.send(this._queue.shift());
			}
		};

		return this;
	}

	// Send data via the WebSocket connection
	send(event, data, callback) {

		// Prepare the data
		if (this._advanced) {
			data = JSON.stringify({
				data,
				event
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
}

module.exports = {
	ws(location, options) {

		return new WS(location, options);
	}
};
return module.exports;});

