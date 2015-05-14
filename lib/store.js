'use strict';

// Session store prototype constructor
var store = function (timeout) {

	var that = this;

	// Prepare sessions container
	this.container = {};

	// Set default timeout to one hour
	if (typeof timeout !== 'number' || timeout < 0) {
		timeout = 3600;
	}

	// Clean the stored sessions at the defined interval
	setInterval(function () {

		var now = Date.now();

		// Loop throught the session objects and delete expired elements
		Object.keys(that.container).forEach(function (id) {
			if (that.container[id].expires <= now) {
				delete that.container[id];
			}
		});
	}, timeout * 1000).unref();
};

// Get session data from the store
store.prototype.get = function (id, callback) {
	callback(this.container[id]);
};

// Save session data to the store
store.prototype.set = function (id, session, callback) {
	this.container[id] = session;
	callback();
};

module.exports = store;