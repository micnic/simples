'use strict';

const Client = require('simples/lib/client/client');
const Server = require('simples/lib/server');
const Store = require('simples/lib/store/store');

module.exports = (...args) => new Server(...args);

module.exports.client = (...args) => new Client(...args);

module.exports.server = module.exports;

module.exports.store = (...args) => new Store(...args);