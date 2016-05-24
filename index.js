'use strict';

var Client = require('simples/lib/client/client'),
	Server = require('simples/lib/server'),
	Store = require('simples/lib/store');

module.exports = Server.create;

module.exports.server = Server.create;

module.exports.client = Client.create;

module.exports.store = Store.create;