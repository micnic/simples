var fs = require('fs');
var http = require('http');
var https = require('https');

var utils = require('../utils/utils');
var ws = require('./ws');

// HTTP(S) Server creator
module.exports = function (parent, options) {
	'use strict';

	// Server instance container
	var server;

	// Create a new http(s).Server instance
	if (options && options.key && options.cert) {
		options = {
			key: fs.readFileSync(options.key),
			cert: fs.readFileSync(options.cert)
		};
		server = https.Server(options, utils.handleHTTPRequest);
	} else {
		server = http.Server(utils.handleHTTPRequest);
	}

	// Container for caching static files content
	server.cache = {};

	// The hosts of the server
	server.hosts = {
		main: parent
	};

	// Listen for upgrade connections dedicated for WebSocket
	server.on('upgrade', ws);

	return server;
};