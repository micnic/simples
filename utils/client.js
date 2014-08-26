// simpleS global namespace
var simples = {};

// simpleS utils namespace
simples.utils = {};

// Transform object to encoded URI keys and values
simples.utils.encode = function (data) {
	'use strict';

	var result = [];

	// Loop through the data elements and encode the keys and the values
	result = Object.keys(data).map(function (element) {

		var key = encodeURIComponent(element),
			value = encodeURIComponent(data[element]);

		return key + '=' + value;
	});

	return result.join('&');
};

// Parse the JSON message and transform binary data if needed
simples.utils.parseMessage = function (data) {
	'use strict';

	var message = JSON.parse(data),
		string = '';

	// Check for binary data
	if (message.type === 'binary') {

		// Append buffer elements to the string
		message.data.forEach(function (element) {
			string += String.fromCharCode(element);
		});

		// Create a new blob and replace the message data
		message.data = new Blob([string]);
	}

	return message;
};

// AJAX microframework
var ajax = simples.ajax = function (url, data, method) {
	'use strict';

	var hash = url.indexOf('#'),
		listeners = {},
		json = false,
		xhr = new XMLHttpRequest();

	// Ignore new keyword
	if (!(this instanceof simples.ajax)) {
		return new simples.ajax(url, data, method);
	}

	// Define private properties for simples.ajax
	Object.defineProperties(this, {
		listeners: {
			value: listeners
		},
		xhr: {
			value: xhr
		}
	});

	// Default error listener
	listeners.error = function () {
		throw new Error('simpleS: Error listener not implemented');
	};

	// Default success listener
	listeners.success = function () {
		throw new Error('simpleS: Success listener not implemented');
	};

	// Set method to lower case for comparison
	if (typeof method === 'string') {
		method = method.toLowerCase();
	}

	// Accept only DELETE, GET, HEAD, POST and PUT methods, defaults to get
	if (['delete', 'head', 'post', 'put'].indexOf(method) < 0) {
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
		url += simples.utils.encode(data);
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
			data = simples.utils.encode(data);
		}
	}

	// Send the data throught the XMLHttpRequest
	xhr.send(data);

	// Listen for changes in the state of the XMLHttpRequest
	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4 && Math.trunc(xhr.status / 100) === 2) {
			listeners.success(xhr.responseText);
		} else if (xhr.readyState === 4) {
			listeners.error(xhr.status, xhr.statusText);
		}
	};
};

// Set the error listener
ajax.prototype.error = function (listener) {
	'use strict';

	// Check if the listener is a function
	if (typeof listener === 'function') {
		this.listeners.error = listener;
	}

	return this;
};

// Abords the ajax transmission
ajax.prototype.stop = function () {
	'use strict';

	this.xhr.abort();
};

// Set the success listener
ajax.prototype.success = function (listener) {
	'use strict';

	// Check if the listener is a function
	if (typeof listener === 'function') {
		this.listeners.success = listener;
	}

	return this;
};

// Client-side simplified Node.JS event emitter implementation
var ee = simples.ee = function () {
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
ee.prototype.addListener = function (event, listener) {
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
ee.prototype.emit = function (event) {
	'use strict';

	var args = Array.apply(null, arguments).slice(1),
		that = this;

	// Throw the error if there are no listeners for error event
	if (event === 'error' && !this.listeners.error) {
		if (args[0] instanceof Error) {
			throw args[0];
		} else if (typeof args[0] === 'string') {
			throw new Error(args[0]);
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

// Shortcut for removeListener and removeAllListeners
ee.prototype.off = function (event, listener) {
	'use strict';

	// Switch behavior if listener is provided
	if (typeof listener === 'function') {
		this.removeListener(event, listener);
	} else {
		this.removeAllListeners(event);
	}

	return this;
};

// Shortcut for addListener
ee.prototype.on = simples.ee.prototype.addListener;

// Append one time listener
ee.prototype.once = function (event, listener) {
	'use strict';

	// Prepare the one time listener
	function onceListener() {
		listener.apply(this, arguments);
		this.removeListener(event, onceListener);
	};

	// Append the listener
	this.on(event, onceListener);

	return this;
};

// Delete all listeners of an event or all listeners of all events
ee.prototype.removeAllListeners = function (event) {
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
ee.prototype.removeListener = function (event, listener) {
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

// WebSocket microframework
var ws = simples.ws = function (url, config) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples.ws)) {
		return new simples.ws(url, config);
	}

	// Call event emitter in this context
	simples.ee.call(this);

	// Set default connection to the root
	if (typeof url !== 'string') {
		url = '/';
	}

	// Set default config
	if (!config || typeof config !== 'object') {
		config = {};
	}

	// Set default mode
	if (typeof config.mode !== 'string' || config.mode !== 'raw') {
		config.mode = 'advanced';
	}

	// Check for WebSocket subprotocols
	if (!Array.isArray(config.protocols)) {
		config.protocols = [];
	}

	// Set default mode
	if (typeof config.type !== 'string' || config.type !== 'binary') {
		config.type = 'text';
	}

	// Define private properties for simples.ws
	Object.defineProperties(this, {
		url: {
			value: url,
			writable: true
		},
		mode: {
			value: config.mode
		},
		opening: {
			value: false,
			writable: true
		},
		protocols: {
			value: config.protocols,
			writable: true
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
		},
		type: {
			value: config.type
		}
	});

	// Open the WebSocket
	this.open();
};

// Inherit from host
ws.prototype = Object.create(simples.ee.prototype, {
	constructor: {
		value: simples.ws
	}
});

// Close the WebSocket
ws.prototype.close = function () {
	'use strict';

	// Close the WebSocket only if it is started
	if (this.started) {
		this.socket.close();
		this.started = false;
	}

	return this;
};

// Open or reopen the WebSocket socket
ws.prototype.open = function (url, protocols) {
	'use strict';

	var protocol = 'ws',
		slashes = 0,
		that = this;

	// Make the url optional
	if (Array.isArray(url)) {
		protocols = url;
		url = this.url;
	} else if (typeof url !== 'string') {
		url = this.url;
	}

	// Make the protocols optional
	if (!Array.isArray(protocols)) {
		protocols = this.protocols;
	}

	// Get the protocol name
	if (window.location.protocol === 'https:') {
		protocol += 's';
	}

	// Index of the protocol slashes
	slashes = url.indexOf('://');

	// Remove protocol from the url
	if (slashes >= 0) {
		url = url.slice(slashes + 3);
	}

	if (url[0] === '/') {
		url = window.location.host + url;
	}

	// Set the correct url and the filtered protocols
	this.url = url;
	this.protocols = protocols.filter(function (element) {
		return typeof element === 'string';
	});

	// Set the opening flag
	this.opening = true;

	// Close the previously used socket
	this.close();

	// Initialize the WebSocket
	if (protocols.length) {
		this.socket = new WebSocket(protocol + '://' + url, protocols);
	} else {
		this.socket = new WebSocket(protocol + '://' + url);
	}

	// Catch connection close
	this.socket.onclose = function () {
		that.started = false;
		that.emit('close');
	};

	// Catch connection errors
	this.socket.onerror = function () {
		that.started = false;
		that.emit('error', 'simpleS: Can not connect to the WebSocket host');
	};

	// Listen for incoming messages
	this.socket.onmessage = function (event) {

		var message;

		// Emit raw data
		if (that.mode === 'raw') {
			that.emit('message', event.data);
			return;
		}

		// Parse and emit complex data
		try {
			message = simples.utils.parseMessage(event.data);
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
ws.prototype.send = function (event, data) {
	'use strict';

	// Prepare the data
	if (this.mode === 'raw') {
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

		// If connection is down then open a new one
		if (!this.opening) {
			this.open();
		}
	}

	return this;
};