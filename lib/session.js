'use strict';

var utils = require('simples/utils/utils');

var session = function (timeout) {
	this.container = {};
	this.id = '';
	this.hash = '';
	this.timeout = timeout;
};

session.prototype.update = function() {
	this.expiration = Date.now() + this.timeout;
};

module.exports = session;