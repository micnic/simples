// simpleS global namespace
var simples = {};

// AJAX microframework
var ajax = simples.ajax = function (url, data, method) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples.ajax)) {
		return new simples.ajax(url, data, method);
	}

	// Accept only GET and POST methods, defaults to get
	if (method !== 'get' && method !== 'post') {
		method = 'get';
	}

	// Create the listeners and the XMLHttpRequest
	var xhr = new XMLHttpRequest();
	var listeners = {
		error: function () {},
		progress: function () {},
		success: function () {}
	};

	// Bind the listeners and the XMLHttpRequest to this context
	Object.defineProperties(this, {
		listeners: {
			value: listeners
		},
		xhr: {
			value: xhr
		}
	});

	// Form data from object
	function objectData(data) {
		var formData = new FormData();
		for (var i in data) {
			formData.append(i, data[i]);
		}
		return formData;
	}

	// Process data
	if (method === 'get') {
		if (~url.indexOf('?')) {
			url += '&';
		} else {
			url += '?';
		}
		url += Object.keys(data).map(function (element) {
			return element + '=' + encodeURIComponent(data[element]);
		}).join('&');
		data = null;
	} else {
		if (data instanceof HTMLFormElement) {
			data = new FormData(data);
		} else {
			data = objectData(data);
		}
	}

	// Open the XMLHttpRequest and send data
	xhr.open(method.toUpperCase(), url);
	xhr.send(data);

	// Listen for changes in the state of the XMLHttpRequest
	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4 && xhr.status === 200) {
			listeners.success(xhr.responseText);
		} else if (xhr.readyState === 4 && xhr.status !== 200) {
			listeners.error(xhr.status, xhr.statusText);
		}
	};

	listeners.progress();
};

// WebSocket microframework
var ws = simples.ws = function (host, protocols, raw) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples.ws)) {
		return new simples.ws(host, protocols, raw);
	}

	// Create internal parameters
	Object.defineProperties(this, {
		host: {
			value: host
		},
		listeners: {
			value: {}
		},
		queue: {
			value: []
		},
		protocols: {
			value: protocols
		},
		raw: {
			value: raw || false
		},
		socket: {
			value: null,
			writable: true
		},
		started: {
			value: null,
			writable: true
		}
	});

	this.open(host, protocols);
};

// Set the error listener
ajax.prototype.error = function (listener) {
	'use strict';

	this.listeners.error = listener;
	return this;
};

// Set the progress listener
ajax.prototype.progress = function (listener) {
	'use strict';

	this.listeners.progress = listener;
	return this;
};

// Abords the ajax transmission
ajax.prototype.stop = function () {
	'use strict';

	this.xhr.abord();
};

// Set the succes listener
ajax.prototype.success = function (listener) {
	'use strict';

	this.listeners.success = listener;
	return this;
};

// Close the WebSocket
ws.prototype.close = function () {
	'use strict';

	// Close the WebSocket only if it is started
	if (this.started) {
		this.socket.close();
	}

	return this;
};

// Trigger the event with the data
ws.prototype.emit = function (event) {
	'use strict';

	// Shortcut for listeners
	var listeners = this.listeners[event];

	// Throw the error if there are no listeners for error event
	if (event === 'error' && !listeners.error) {
		if (arguments[1] instanceof Error) {
			throw arguments[1];
		} else if (typeof arguments[1] === 'string') {
			throw new Error(arguments[1]);
		} else {
			throw new Error("Uncaught, unspecified 'error' event.");
		}
	}

	// Check for listeners
	if (listeners) {
		var length = arguments.length - 1;
		var args = new Array(length);
		var index = 0;

		// Prepare the arguments for the listeners
		while (index < length) {
			args[index++] = arguments[index];
		}

		// Only one listener
		if (typeof listeners === 'function') {
			listeners.apply(this, args);
			return this;
		}

		// Recycle variables
		index = 0;
		length = listeners.length;

		// Call all listeners
		while (index < length) {
			listeners[index++].apply(this, args);
		}
	}

	return this;
};

// Append listener for an event
ws.prototype.addListener = function (event, listener) {
	'use strict';

	// Shortcut for listeners
	var listeners = this.listeners[event];

	// Add the listener
	if (!listeners) {
		this.listeners[event] = listener;
	} else if (typeof listeners === 'function') {
		listeners = [listeners, listener];
	} else {
		listeners[listeners.length] = listener;
	}

	return this;
};

// Shortcut to addListener
ws.prototype.on = simples.ws.prototype.addListener;

// Append one time listener
ws.prototype.once = function (event, listener) {
	'use strict';

	// Prepare the one time listener
	var oneTimeListener = function () {
		listener.apply(this, arguments);
		this.removeListener(event, oneTimeListener);
	};

	// Append the listener
	this.on(event, oneTimeListener);
	return this;
};

// Delete all listeners of an event or all listeners of all events
ws.prototype.removeAllListeners = function (event) {
	'use strict';

	// If event is provided remove all its listeners
	if (event) {
		delete this.listeners[event];
	} else {
		this.listeners = {};
	}

	return this;
};

// Delete specific listener
ws.prototype.removeListener = function (event, listener) {
	'use strict';

	// Shortcut for listeners
	var listeners = this.listeners[event];

	// Remove the only one listener
	if (typeof listeners === 'function') {
		delete this.listeners[event];
		return this;
	}

	// Prepare the index of the listener
	var index = listeners.length;

	// Search for listener and remove it
	while (index--) {
		if (listeners[index] === listener) {
			listeners.splice(index, 1);
			break;
		}
	}
	
	// If only one listener remains make it function
	if (listeners.length === 1) {
		listeners = listeners[0];
	}

	return this;
};

// Send data via the WebSocket in raw or advanced mode
ws.prototype.send = function () {
	'use strict';

	// Prepare the data
	var data;
	if (this.raw) {
		data = arguments[0];
	} else {
		data = JSON.stringify({
			event: arguments[0],
			data: arguments[1]
		});
	}

	// Check for open socket
	if (this.started) {
		this.socket.send(data);
	} else {

		// Push the message to the end of the queue
		this.queue[this.queue.length] = data;

		// If connection is down open a new one
		if (this.started === false) {
			this.open(this.host, this.protocols);
		}
	}
	
	return this;
};

// Open or reopen the WebSocket socket
ws.prototype.open = function (host, protocols) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Close the previously used socket
	this.close();

	// Initialize the WebSocket
	this.socket = new WebSocket('ws://' + host, protocols);

	// Catch connection close
	this.socket.onclose = function () {
		that.started = false;
		that.emit('close');
	};

	// Catch connection errors
	this.socket.onerror = function () {
		that.emit('error', 'simpleS: can not connect to the WebSocket server');
	};

	// Listen for incoming messages
	this.socket.onmessage = function (event) {
		if (that.raw) {
			that.emit('message', event.data);
			return;
		}
		try {
			var message = JSON.parse(event.data);
			that.emit(message.event, message.data);
		} catch (error) {
			that.emit('error', 'simpleS: can not parse incoming message');
			that.emit('message', event.data);
		}
	};

	// Listen for socket open
	this.socket.onopen = function () {
		
		// Set the started flag
		that.started = true;

		// send the messages from the queue
		while (that.queue.length) {
			that.socket.send(that.queue.shift());
		}
	};
};