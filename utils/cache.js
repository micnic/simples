'use strict';

var client = {},
	fs = require('fs');

// File cache prototype constructor
var cache = function (location) {

	// The container for the cached content
	this.container = {
		files: {},
		stats: null
	};

	// Initialize the instance only if the location is provided
	if (location) {
		this.container.location = location;
		this.init();
	}
};

// Cache the provided directory
cache.prototype.addDirectory = function (object, location) {

	var that = this;

	// Add an element to the cache object
	function addElement(element) {
		that.addElement(object, location + '/' + element);
	}

	// Directory files container
	object.files = {};

	// Read the directory content
	fs.readdir(location, function (error, files) {
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else {
			files.forEach(addElement);
		}
	});
};

// Check the stats of the provided location
cache.prototype.addElement = function (object, location) {

	var name = location.substr(location.lastIndexOf('/') + 1),
		that = this;

	// Create a new object for the element
	object.files[name] = {};

	// Check element stats and add it to the cache
	fs.stat(location, function (error, stats) {

		// Prepare the object of the element
		object.files[name].location = location;
		object.files[name].stats = stats;

		// Check for errors and add the element to the cache
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else if (stats.isDirectory()) {
			that.addDirectory(object.files[name], location);
			that.watchLocation(object.files[name], location);
		} else {
			that.addFile(object.files[name], location);
		}
	});
};

// Cache the provided file
cache.prototype.addFile = function (object, location) {
	fs.readFile(location, function (error, content) {
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
		} else {
			object.content = content;
		}
	});
};

// Removes all the data contained by the instance and file watchers
cache.prototype.destroy = function () {
	this.unwatchLocation(this.container);
	this.container = null;
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
			that.addDirectory(that.container, location);
			that.watchLocation(that.container, location);
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
		object = client;
	} else {
		object = location.split('/').reduce(getFileObject, this.container);
	}

	return object;
};

// Remove the file watchers from the location
cache.prototype.unwatchLocation = function (object) {

	var that = this;

	// Unwatch the current object location
	fs.unwatchFile(object.location);

	// Loop througth the object files and unwatch directories
	Object.keys(object.files).forEach(function (element) {
		if (element.files) {
			that.unwatchLocation(element);
		}
	});
};

// Watch the location for changes and make changes in the cache
cache.prototype.watchLocation = function (object, location) {

	var that = this;

	// Create the file watcher
	fs.watchFile(location, {
		persistent: false
	}, function (current) {
		if (!current.nlink && object === that.container) {
			that.container.files = {};
			fs.unwatchFile(location);
		} else if (!current.nlink && object !== that.container) {
			delete object.files[location.substr(location.lastIndexOf('/') + 1)];
			fs.unwatchFile(location);
		} else {
			object.stats = current;
			that.addDirectory(object, location);
		}
	});
};

// Prepare client-side simples.js content
fs.stat(__dirname + '/simples.js', function (error, stats) {
	stats && fs.readFile(__dirname + '/simples.js', function (error, content) {
		if (error) {
			console.error('\nsimpleS: Can not read "simples.js"');
			console.error(error.stack + '\n');
			console.error('Try to reinstall simpleS, something went wrong\n');
		} else {
			client.content = content;
			client.stats = stats;
		}
	});
});

module.exports = cache;