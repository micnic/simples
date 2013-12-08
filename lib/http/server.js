'use strict';

var events = require('events'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	utils = require('../../utils/utils');

var server = function (parent, options) {

	var that = this;

	// Call events.EventEmitter in this context
	events.EventEmitter.call(this);

	// Prepare the internal objects
	this.instance = null;
	this.parent = parent;
	this.secondary = null;
	this.secured = false;

	// Unblock the parent on server release
	this.on('release', function (callback) {
		that.parent.busy = false;

		// Call the callback when the server is free
		if (callback) {
			callback.call(that.parent);
		}
	});

	// Create the internal instance server
	if (options && (options.cert && options.key || options.pfx)) {
		this.getCertificates(options, function () {
			that.instance = https.Server(options);
			that.secondary = http.Server();
			that.secured = true;
			that.addListeners();
			that.emit('ready');
		});
	} else if (!options) {
		that.instance = http.Server();
		that.addListeners();
	} else {
		throw new Error('simpleS: Invalid data for the HTTPS server');
	}
};

// Inherit from events.EventEmitter
server.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: server
	}
});

// Add event listeners to the internal instances
server.prototype.addListeners = function () {

	var that = this;

	// Determine the host and 
	function getHost(request, response, callback) {

		var host;

		// Check if host is provided by the host header
		if (request.headers.host) {
			host = that.parent.hosts[request.headers.host.split(':')[0]];
		}

		// Get the main host if the other one does not exist
		if (!host) {
			host = that.parent.hosts.main;
		}

		// Send the HTTP host to the callback
		callback(host, request, response);
	}

	// Request listener for simple HTTP requests
	function httpRequestListener(request, response) {
		getHost(request, response, utils.http.requestListener);
	}

	// Request listener for HTTP requests with upgrade header for WS
	function wsRequestListener(request, response) {
		getHost(request, response, utils.ws.requestListener);
	}

	// Attache the event listeners to the HTTP server instance
	this.instance.on('error', function (error) {
		that.parent.busy = false;
		that.parent.started = false;
		throw new Error('simpleS: Server error > ' + error.message);
	}).on('request', httpRequestListener).on('upgrade', wsRequestListener);

	// Check for secondary HTTP server
	if (this.secondary) {

		// Catch the errors and listen for upgrade in the secondary HTTP server
		this.secondary.on('error', function (error) {
			that.instance.emit('error', error);
		}).on('request', httpRequestListener).on('upgrade', wsRequestListener);

		// Manage the HTTP server depending on HTTPS server events
		this.instance.on('open', function () {
			that.secondary.listen(80);
		}).on('close', function () {
			that.secondary.close();
		});
	}
};

// Call the close method of the internal instance
server.prototype.close = function (callback) {
	this.instance.close(callback);
};

// Read the certificates for the HTTPS server
server.prototype.getCertificates = function (options, callback) {

	var files = Object.keys(options).filter(function (element) {
			return ['cert', 'key', 'pfx'].indexOf(element) >= 0;
		});

	// Listener for file reading end
	function onFileRead(error, content) {

		// Check for error on reading files
		if (error) {
			console.error('simpleS: Can not read HTTPS certificates');
			throw error;
		}

		// Set the content of the file in the options object
		options[files.shift()] = content;

		// Read the next file or call the callback function
		if (files.length) {
			fs.readFile(options[files[0]], onFileRead);
		} else {
			callback();
		}
	}

	// Read the first file
	fs.readFile(options[files[0]], onFileRead);
};

// Call the listen method of the internal instance
server.prototype.listen = function (port, callback) {
	this.instance.emit('open');
	this.instance.listen(port, callback);
};

module.exports = server;