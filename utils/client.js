// simpleS global namespace
var simples = {};

// AJAX microframework
simples.ajax = function (url, data, method) {
	'use strict';

	var hash = url.indexOf('#'),
		listeners = {
			error: function () {},
			success: function () {}
		},
		json = false,
		xhr = new XMLHttpRequest();

	// Transform object to encoded URI keys and values
	function encode(data) {
		var key,
			value;

		return Object.keys(data).map(function (element) {
			key = encodeURIComponent(element);
			value = encodeURIComponent(data[element]);
			return key + '=' + value;
		}).join('&');
	}

	// Ignore new keyword
	if (!(this instanceof simples.ajax)) {
		return new simples.ajax(url, data, method);
	}

	// Define special properties for simples.ajax
	Object.defineProperties(this, {
		listeners: {
			value: listeners
		},
		xhr: {
			value: xhr
		}
	});

	// Accept only DELETE, GET, HEAD, POST and PUT methods, defaults to get
	if (['delete', 'get', 'head', 'post', 'put'].indexOf(method) < 0) {
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
		url += encode(data);
		data = null;
	}

	// Open the XMLHttpRequest
	xhr.open(method.toUpperCase(), url);

	if (data instanceof HTMLFormElement) {
		data = new FormData(data);
	} else if (data && typeof data === 'object') {

		// Check if data contains objects inside
		json = Array.isArray(data) || Object.keys(data).some(function (key) {
			return typeof data[key] === 'object';
		});

		// Stringify data
		if (json) {
			data = JSON.stringify(data);
			xhr.setRequestHeader('Content-Type', 'application/json');
		} else {
			data = encode(data);
		}
	}

	// Send the data throught the XMLHttpRequest
	xhr.send(data);

	// Listen for changes in the state of the XMLHttpRequest
	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4 && (xhr.status / 100 | 0) === 2) {
			listeners.success(xhr.responseText);
		} else if (xhr.readyState === 4) {
			listeners.error(xhr.status, xhr.statusText);
		}
	};
};

// Set the error listener
simples.ajax.prototype.error = function (listener) {
	'use strict';

	this.listeners.error = listener;

	return this;
};

// Abords the ajax transmission
simples.ajax.prototype.stop = function () {
	'use strict';

	this.xhr.abort();
};

// Set the succes listener
simples.ajax.prototype.success = function (listener) {
	'use strict';

	this.listeners.success = listener;

	return this;
};

// Client-side Node.JS event emitter implementation
simples.ee = function () {
	'use strict';

	// Ignore new keyword
	if (!this instanceof simples.ee) {
		return new simples.ee();
	}

	// Define listeners object
	Object.defineProperty(this, 'listeners', {
		value: {},
		writable: true
	});
};

// Append listener for an event
simples.ee.prototype.addListener = function (event, listener) {
	'use strict';

	// Check if more listeners exist for this event
	if (!this.listeners[event]) {
		this.listeners[event] = [];
	}

	// Push the listener to the event listeners array
	this.listeners[event].push(listener);

	return this;
};

// Trigger the event with the data
simples.ee.prototype.emit = function (event) {
	'use strict';

	var args = Array.prototype.slice.call(arguments, 1),
		that = this;

	// Throw the error if there are no listeners for error event
	if (event === 'error' && !this.listeners.error) {
		if (arguments[1] instanceof Error) {
			throw arguments[1];
		} else if (typeof arguments[1] === 'string') {
			throw new Error(arguments[1]);
		} else {
			throw new Error('Uncaught, unspecified "error" event.');
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

// Delete all listeners of an event or all listeners of all events
simples.ee.prototype.removeAllListeners = function (event) {
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
simples.ee.prototype.removeListener = function (event, listener) {
	'use strict';

	// Shortcut for listeners
	var index;

	// Check if the event has listeners and remove the needed one
	if (this.listeners[event]) {
		index = this.listeners[event].indexOf(listener);
		this.listeners[event].splice(index, 1);
	}

	return this;
};

// Shortcut for removeListener and removeAllListeners
simples.ee.prototype.off = function (event, listener) {
	'use strict';

	// Switch behavior if listener is provided
	if (listener) {
		this.removeListener(event, listener);
	} else {
		this.removeAllListeners(event);
	}

	return this;
};

// Shortcut for addListener
simples.ee.prototype.on = simples.ee.prototype.addListener;

// Append one time listener
simples.ee.prototype.once = function (event, listener) {
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

// WS microframework
simples.ws = function (host, protocols, raw) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples.ws)) {
		return new simples.ws(host, protocols, raw);
	}

	// Call event emitter in this context
	simples.ee.call(this);

	// Get raw parameter if it is defined
	if (typeof protocols === 'boolean') {
		raw = protocols;
		protocols = [];
	}

	// Define special properties for simples.ws
	Object.defineProperties(this, {
		host: {
			value: host,
			writable: true
		},
		queue: {
			value: []
		},
		opening: {
			value: false,
			writable: true
		},
		protocols: {
			value: protocols,
			writable: true
		},
		raw: {
			value: Boolean(raw)
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

// Inherit from host
simples.ws.prototype = Object.create(simples.ee.prototype, {
	constructor: {
		value: simples.ws
	}
});

// Close the WebSocket
simples.ws.prototype.close = function () {
	'use strict';

	// Close the WebSocket only if it is started
	if (this.started) {
		this.socket.close();
		this.started = false;
	}

	return this;
};

// Open or reopen the WebSocket socket
simples.ws.prototype.open = function (host, protocols) {
	'use strict';

	var protocol = 'ws',
		that = this;

	// Make the host and the protocols optional
	host = host || this.host;
	protocols = protocols || this.protocols;

	// Get the protocol name
	if (location.protocol === 'https:') {
		protocol += 's';
	}

	// Get the host
	if (host[0] === '/' && host.indexOf(location.host) !== 0) {
		this.host = host = location.host + host;
	}

	// Set the opening flag
	this.opening = true;

	// Close the previously used socket
	this.close();

	// Initialize the WebSocket
	if (protocols.length) {
		this.socket = new WebSocket(protocol + '://' + host, protocols);
	} else {
		this.socket = new WebSocket(protocol + '://' + host);
	}

	// Catch connection close
	this.socket.onclose = function () {
		that.started = false;
		that.emit('close');
	};

	// Catch connection errors
	this.socket.onerror = function () {
		that.started = false;
		that.emit('error', 'simpleS: Can not connect to the WS server');
	};

	// Transform Node.JS buffer to browser blob
	function bufferToBlob(buffer) {
		var string = '',
			i;
		for (i = 0; i < buffer.length; i++) {
			string += String.fromCharCode(buffer[i]);
		}
		return new Blob([string]);
	}

	// Parse the JSON message and transform binary data if needed
	function parseMessage(data) {
		var message = JSON.parse(data);

		// Check for binary data
		if (message.binary) {
			message.data = bufferToBlob(message.data);
		}

		return message;
	}

	// Listen for incoming messages
	this.socket.onmessage = function (event) {

		var message;

		// Emit raw data
		if (that.raw) {
			that.emit('message', event.data);
			return;
		}

		// Parse and emit complex data
		try {
			message = parseMessage(event.data);
			that.emit(message.event, message.data);
		} catch (error) {
			that.emit('error', 'simpleS: Can not parse incoming message');
			that.emit('message', event.data);
		}
	};

	// Listen for socket open
	this.socket.onopen = function () {

		// Set the started flag
		that.started = true;
		that.opening = false;

		// send the messages from the queue
		while (that.queue.length) {
			that.socket.send(that.queue.shift());
		}
	};
};

// Send data via the WebSocket in raw or advanced mode
simples.ws.prototype.send = function (event, data) {
	'use strict';

	// Prepare the data
	if (this.raw) {
		data = event;
	} else {
		data = JSON.stringify({
			event: event,
			data: data
		});
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

		// If connection is down open a new one
		if (!this.opening) {
			this.open();
		}
	}

	return this;
};