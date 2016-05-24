'use strict';

// Session store prototype constructor
var Store = function (timeout) {

	var that = this;

	// Prepare sessions container
	this.container = {};

	// Set default timeout to one hour
	if (typeof timeout !== 'number' || timeout < 0) {
		timeout = 3600;
	}

	// Clean the stored sessions at the defined interval
	/* istanbul ignore next: no need to test one hour timeout store clean up */
	setInterval(function () {

		var now = Date.now();

		// Loop throught the session objects and delete expired elements
		Object.keys(that.container).forEach(function (id) {
			if (that.container[id].expire <= now) {
				delete that.container[id];
			}
		});
	}, timeout * 1000).unref();
};

// Store factory function
Store.create = function (timeout) {

	return new Store(timeout);
};

// Get session data from the store
Store.prototype.get = function (id, callback) {
	callback(this.container[id] || null);
};

// Save session data to the store
Store.prototype.set = function (id, session, callback) {
	this.container[id] = session;
	callback();
};

module.exports = Store;