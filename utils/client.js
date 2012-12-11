// simpleS global namespace
var simples = {

	// AJAX microframework
	ajax: function (url, method, data) {
		'use strict';

		// Accept only GET and POST methods
		if (method !== 'get' && method !== 'post') {
			return;
		}

		// Ignore new keyword
		if (!(this instanceof simples.ajax)) {
			return new simples.ajax(url, method, data);
		}

		// Create listeners
		Object.defineProperty(this, 'listeners', {
			value: {
				error: function () {},
				progress: function () {},
				success: function () {}
			}
		});

		// Create the XMLHttpRequest and process data
		var xhr = new XMLHttpRequest();
		if (method === 'get') {
			url += ~url.indexOf('?') ? '&' : '?';
			url += Object.keys(data).map(function (element) {
				return element + '=' + encodeURIComponent(data[element]);
			}).join('&');
			data = null;
		} else {
			if (data instanceof HTMLFormElement) {
				data = new FormData(data);
			} else {
				var formData = new FormData();
				Object.keys(data).forEach(function (element) {
					formData.append(element, data[element]);
				});
				data = formData;
			}
		}

		// Open the XMLHttpRequest and send data
		xhr.open(method.toUpperCase(), url);
		xhr.send(data);

		// Listen for changes in the state of the XMLHttpRequest
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4 && xhr.status === 200) {
				this.listeners.success(xhr);
			} else if (xhr.readyState === 4 && xhr.status !== 200) {
				this.listeners.error(xhr);
			} else {
				this.listeners.progress(xhr);
			}
		}.bind(this);
	},

	// WebSocket microframework
	ws: function (host, protocols, raw) {
		'use strict';

		// Ignore new keyword
		if (!(this instanceof simples.ws)) {
			return new simples.ws(host, protocols, raw);
		}

		// Create internal parameters
		Object.defineProperties(this, {
			listeners: {
				value: {}
			},
			queue: {
				value: []
			},
			raw: {
				value: raw
			},
			socket: {
				value: new WebSocket('ws://' + host, protocols)
			},
			started: {
				value: false
			}
		});

		// Listen for incoming messages
		this.socket.onmessage = function (event) {
			if (this.raw) {
				this.emit('message', event.data);
			} else {
				try {
					var message = JSON.parse(event.data);
					if (message && this.listeners[message.event]) {
						this.emit(message.event, message.data);
					}
				} catch (error) {
					console.log('simpleS: cannot parse incoming WebSocket message\nmessage event emitted');
					this.emit('message', event.data);
				}
			}
		}.bind(this);

		// Listen for socket open
		this.socket.onopen = function () {
			this.queue.forEach(function (element) {
				this.socket.send(element);
			}.bind(this));
			this.started = true;
			delete this.queue;
		}.bind(this);
	}
}

// Set the error listener
simples.ajax.prototype.error = function (listener) {
	this.listeners.error = listener;
	return this;
};

// Set the progress listener
simples.ajax.prototype.progress = function (listener) {
	this.listeners.progress = listener;
	return this;
};

// Set the succes listener
simples.ajax.prototype.success = function (listener) {
	this.listeners.success = listener;
	return this;
};

// Close the WebSocket
simples.ws.prototype.close = function () {
	this.socket.close();
}

// Trigger the event with the data
simples.ws.prototype.emit = function (event, data) {
	if (this.listeners[event]) {
		this.listeners[event].forEach(function (element) {
			element(data);
		});
	}

	return this;
};

// Append listener for an event
simples.ws.prototype.addListener = function (event, listener) {
	if (!Array.isArray(this.listeners[event])) {
		this.listeners[event] = [];
	}

	this.listeners[event].push(listener);
	return this;
};

// Shortcut to addListener
simples.ws.prototype.on = simples.ws.prototype.addListener;

// Append only one time listener
simples.ws.prototype.once = function (event, listener) {
	var oneTimeListener = function () {
		listener.apply(this, arguments);
		this.removeListener(event, oneTimeListener);
	};

	this.on(event, oneTimeListener);
	return this;
};

// Delete all listeners of an event or all listeners of all events
simples.ws.prototype.removeAllListeners = function (event) {
	if (event) {
		delete this.listeners[event];
	} else {
		this.listeners = {};
	}

	return this;
};

// Delete specific listener
simples.ws.prototype.removeListener = function (event, listener) {
	var index = this.listeners[event].indexOf(listener);
	this.listeners[event].splice(index, 1);
	return this;
};

// Send data via the WebSocket in raw or advanced mode
simples.ws.prototype.send = function () {
	if (this.raw) {
		data = arguments[0];
	} else {
		data = JSON.stringify({
			event: arguments[0],
			data: arguments[1]
		})
	}

	if (this.started) {
		this.socket.send(data);
	} else {
		this.queue.push(data);
	}
	
	return this;
};