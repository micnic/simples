'use strict';

// Session store prototype constructor
var store = function () {

	// Prepare sessions container
	this.sessions = {};
};

// Get session data from the store
store.prototype.get = function (id, callback) {
	callback(this.sessions[id]);
};

// Clean expired sessions
store.prototype.clean = function () {

	var now = Date.now(),
		that = this;

	// Loop throught the session objects and select the expired to delete them
	Object.keys(this.sessions).forEach(function (session) {
		if (that.sessions[session].expires <= now) {
			delete that.sessions[session];
		}
	});
};

// Save session data to the store
store.prototype.set = function (id, session, callback) {
	this.sessions[id] = session;
	callback();
};

module.exports = store;