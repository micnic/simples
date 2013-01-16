var fs = require('fs');

var host = require('./lib/host');
var server = require('./lib/server');

// TODO: function to get sessions from file
/*if (fs.existsSync('.sessions')) {
	var sessions = JSON.parse(fs.readFileSync('.sessions', 'utf8'));
	Object.keys(this.hosts).forEach(function (element) {
		if (sessions[element]) {
			that.hosts[element].sessions = sessions[element];
		}
	});
}*/

// TODO: function save sessions to file
/*var sessions = {};
Object.keys(this.hosts).forEach(function (element) {
	sessions[element] = that.hosts[element].sessions;
});
fs.writeFileSync('.sessions', JSON.stringify(sessions), 'utf8');*/

// SimpleS prototype constructor
var simples = module.exports = function (port) {
	'use strict';

	// Ignore new keyword
	if (!(this instanceof simples)) {
		return new simples(port);
	}

	// Shortcuts
	var that = this;
	var hosts = {
		main: this
	};

	// Call host in this context
	host.call(this);

	// Set simpleS properties
	Object.defineProperties(this, {
		busy: {
			value: false,
			writable: true
		},
		hosts: {
			value: hosts
		},
		started: {
			value: false,
			writable: true
		}
	});

	// Initialize the HTTP server
	Object.defineProperty(this, 'server', {
		value: new server(hosts)
	});

	// Set keep alive timeout to 5 seconds
	this.server.on('connection', function (socket) {
		socket.setTimeout(5000);
	});

	// Catch runtime errors
	this.server.on('error', function (error) {
		console.log('simpleS: Server Error\n' + error.message + '\n');
		that.started  = false;
		that.busy = false;
	});

	// Inform when the server is not busy
	this.server.on('release', function (context, callback) {
		that.busy = false;
		if (callback) {
			callback.call(context);
		}
	});

	// Start the server on the provided port
	this.start(port);
};

// Inherit from host
simples.prototype = Object.create(host.prototype, {
	constructor: {
		value: simples,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// Specify the template engine to render the responses
simples.prototype.engine = function (engine, render) {
	'use strict';

	// Prepare template engine
	this.server.engine = engine;

	// Choose the rendering method
	if (render) {
		this.server.render = engine[render];
	} else if (engine.render) {
		this.server.render = engine.render;
	} else {
		this.server.render = engine;
	}

	return this;
};

// Create a new host
simples.prototype.host = function (name) {
	'use strict';

	// Create the new host and save it to the hosts object
	this.hosts[name] = new host(name);
	return this.hosts[name];
};

// Start simples server
simples.prototype.start = function (port, callback) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Set the server to listen the port
	function listen() {
		that.server.listen(port, function () {
			that.server.emit('release', that, callback);
		});
	}

	// Start or restart the server
	function start() {
		that.busy = true;
		if (that.started) {
			that.server.close(listen);
		} else {
			this.server.port = port;
			that.started = true;
			listen.call(that);
		}
		
	};

	// If the server is busy wait for release
	if (this.busy) {
		this.server.once('release', function () {
			start.call(that);
		});
	} else {
		start.call(this);
	}

	return this;
};

// Stop simpleS server
simples.prototype.stop = function (callback) {
	'use strict';

	// Shortcut to this context
	var that = this;

	// Stop the server
	function stop() {
		this.started = false;
		this.busy = true;
		this.server.close(function () {
			that.server.emit('release', that, callback);
		});
	}

	// Remove active sessions sessions
	for (var i in this.hosts) {
		for (var j in this.hosts[i].sessions) {
			clearTimeout(this.hosts[i].sessions[j]._timeout);
		}
	}

	// Stop the server only if it is running
	if (this.started && this.busy) {
		this.server.once('release', function () {
			stop.call(that);
		});
	} else if (this.started) {
		stop.call(this);
	}

	return this;
};