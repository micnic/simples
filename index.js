'use strict';

const Client = require('simples/lib/client/client');
const Server = require('simples/lib/server');
const Store = require('simples/lib/store/store');

module.exports = Server.create.bind(Server);

module.exports.client = Client.create;

module.exports.server = Server.create;

module.exports.store = Store.create;