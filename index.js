'use strict';

// TODO: In Node 12+ use import / export syntax and .mjs extension for files
const Client = require('simples/lib/client');
const Server = require('simples/lib/server');
const Store = require('simples/lib/session/store');

module.exports = (...args) => new Server(...args);

module.exports.client = (...args) => new Client(...args);

module.exports.server = module.exports;

module.exports.store = (...args) => new Store(...args);