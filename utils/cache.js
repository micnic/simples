'use strict';

var fs = require('fs'),
	path = require('path');

// File cache prototype constructor
var cache = function (location, callback) {

	// Prepare cache container and update callback
	this.callback = callback || function () {};
	this.container = {};

	// Prepare the client file
	if (!cache.client) {
		cache.prepareClient();
	}

	// Initialize the instance only if the location is provided
	if (location) {
		this.container.location = location;
		this.init();
	}
};

// Prepare the client file stats
cache.prepareClient = function () {

	cache.client = {};

	// Get the stats of the client file
	fs.stat(__dirname + '/client.js', function (error, stats) {
		if (error) {
			console.error('\nsimpleS: Can not get "client.js" stats');
			console.error(error.stack + '\n');
		} else {
			cache.client.stats = stats;
			cache.readClientFile();
		}
	});
};

// Read the client file
cache.readClientFile = function () {

	// Read the file
	fs.readFile(__dirname + '/client.js', function (error, content) {
		if (error) {
			console.error('\nsimpleS: Can not read "client.js"');
			console.error(error.stack + '\n');
		} else {
			cache.client.content = content;
		}
	});
};

// Cache the provided directory
cache.prototype.addDirectory = function (object, location, callback) {

	var that = this;

	// Filter the files that were removed
	function filterRemoved(files) {
		Object.keys(object.files).filter(function (element) {
			return files.indexOf(element) < 0;
		}).forEach(function (element) {
			delete object.files[element];
		});
	}

	// Process the firectory elements
	function processDirectory(files) {

		// Remove inexistent files
		if (object.files) {
			filterRemoved(files);
		}

		// Add the files
		if (files.length) {
			that.addElement(object, files, callback);
		} else {
			callback.call(that);
		}
	}

	// Create the files container and watch for changes in directory
	if (!object.files) {
		object.files = {};
		that.watchDirectory(object, location);
	}

	// Read the directory content
	fs.readdir(location, function (error, files) {
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else {
			processDirectory(files);
		}
	});
};

// Check the stats of the provided location
cache.prototype.addElement = function (object, stack, callback) {

	var location = path.join(object.location, stack.shift()),
		name = path.basename(location),
		that = this;

	// Get next element
	function getNext() {
		if (stack.length) {
			that.addElement(object, stack, callback);
		} else {
			callback.call(that);
		}
	}

	// Create a new object for the element if it does not exist
	if (!object.files[name]) {
		object.files[name] = {};
	}

	// Check element stats and add it to the cache
	fs.stat(location, function (error, stats) {

		var element = object.files[name],
			modified = true;

		// Check for modified element
		if (element.stats) {
			modified = element.stats.mtime.valueOf() !== stats.mtime.valueOf();
		}

		// Prepare the object of the element
		if (modified) {
			element.location = location;
			element.stats = stats;
		}

		// Check for errors and add the element to the cache
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else if (modified && stats.isDirectory()) {
			that.addDirectory(element, location, getNext);
		} else if (modified) {
			that.addFile(element, location, getNext);
		} else {
			getNext();
		}
	});
};

// Cache the provided file
cache.prototype.addFile = function (object, location, callback) {

	var that = this;

	// Read the file content
	fs.readFile(location, function (error, content) {

		// Check for errors and populate the object content
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else {
			object.content = content;
		}

		// Continue with the next element
		callback.call(that);
	});
};

// Removes all the data contained by the instance and file watchers
cache.prototype.destroy = function () {
	if (this.container.files) {
		this.unwatchDirectory(this.container);
	}
};

// Initialize the cache instance
cache.prototype.init = function () {

	var location = this.container.location,
		that = this;

	// Check root directory stats and prepare the cache container
	fs.stat(location, function (error, stats) {
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else if (!stats.isDirectory()) {
			console.error('\nsimpleS: "' + location + '" is not a directory\n');
		} else {
			that.container.stats = stats;
			that.addDirectory(that.container, location, that.callback);
		}
	});
};

// Read the provided location from cache
cache.prototype.read = function (location) {

	var object = null;

	// Get the file object
	function getFileObject(previous, current) {

		var result = null;

		// Check for a valid object
		if (previous && previous.files && previous.files[current]) {
			result = previous.files[current];
		}

		return result;
	}

	// Check for client API file location
	if (location === 'simples.js') {
		object = cache.client;
	} else {
		object = location.split('/').reduce(getFileObject, this.container);
	}

	return object;
};

// Remove the file watchers from the location
cache.prototype.unwatchDirectory = function (object) {

	var that = this;

	// Unwatch the current object location
	fs.unwatchFile(object.location);

	// Loop througth the object files and unwatch directories
	Object.keys(object.files).forEach(function (element) {
		if (object.files[element].files) {
			that.unwatchDirectory(object.files[element]);
		}
	});

	// Reset cache container
	if (object === this.container) {
		this.container = {};
	}
};

// Watch the location for changes and make changes in the cache
cache.prototype.watchDirectory = function (object, location) {

	var that = this;

	// Create the file watcher
	fs.watchFile(location, {
		persistent: false
	}, function (current, prev) {
		if (!current.nlink) {
			that.unwatchDirectory(object);
		} else {
			object.stats = current;
			that.addDirectory(object, location, that.callback);
		}
	});
};

module.exports = cache;