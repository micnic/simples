'use strict';

// Session store prototype constructor
var store = function (timeout) {

	var that = this;

	// Prepare sessions container
	this.sessions = {};

	// Set default timeout to one hour
	if (typeof timeout !== 'number' || timeout < 0) {
		timeout = 3600;
	}

	// Clean the stored sessions at the defined interval
	setInterval(function () {

		var now = Date.now();

		// Loop throught the session objects and delete expired elements
		Object.keys(this.sessions).forEach(function (session) {
			if (that.sessions[session].expires <= now) {
				delete that.sessions[session];
			}
		});
	}, timeout * 1000).unref();
};

// Get session data from the store
store.prototype.get = function (id, callback) {
	callback(this.sessions[id]);
};

// Save session data to the store
store.prototype.set = function (id, session, callback) {
	this.sessions[id] = session;
	callback();
};

module.exports = store;