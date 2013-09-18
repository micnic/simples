'use strict';

var client,
	fs = require('fs');

// Remove recursively all file watchers from the cache
function recursiveUnwatch(object) {

	// Unwatch the current object location
	fs.unwatchFile(object.location);

	// Loop througth the object files
	Object.keys(object.files).forEach(function (element) {
		if (element.files) {
			recursiveUnwatch(element);
		} else {
			fs.unwatchFile(element.location);
		}
	});
}

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

	// Directory files container
	object.files = {};

	// Read the directory content
	fs.readdir(location, function (error, files) {

		// Emit error and stop
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
			return;
		}

		// Check all files
		files.forEach(function (element) {
			that.checkElement(object, location + '/' + element);
		});
	});
};

// Cache the provided file
cache.prototype.addFile = function (object, location) {

	var content = new Buffer(0);

	// Add data to the content using a readable stream
	fs.ReadStream(location).on('error', function (error) {
		console.error('\nsimpleS: Can not read "' + location + '"');
		console.error(error.stack + '\n');
	}).on('readable', function () {
		content = Buffer.concat([content, this.read() || new Buffer(0)]);
	}).on('end', function () {
		object.content = content;
	});
};

// Check the stats of the provided location
cache.prototype.checkElement = function (object, location) {

	var element,
		modified = true,
		name = location.substr(location.lastIndexOf('/') + 1),
		that = this;

	element = object.files[name];

	// Check file and folder stats
	fs.stat(location, function (error, stats) {

		// Emit error and stop
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
			return;
		}

		// Check if element exists in cache and is modified
		if (element) {
			modified = stats.mtime.valueOf() !== element.stats.mtime.valueOf();
		} else {
			object.files[name] = {};
		}

		// Create a new object with stats for element if modified
		if (modified) {
			object.files[name].location = location;
			object.files[name].stats = stats;
			that.watchLocation(object, location);
		}

		// Check if element is not in cache or is modified
		if (modified && stats.isDirectory()) {
			that.addDirectory(object.files[name], location);
		} else if (modified && !stats.isDirectory()) {
			that.addFile(object.files[name], location);
		}
	});
};

// Removes all the data contained by the instance and file watchers
cache.prototype.destroy = function () {
	recursiveUnwatch(this.container);
	this.container = null;
};

// Initialize the cache instance
cache.prototype.init = function () {

	var location = this.container.location,
		that = this;

	// Check root directory stats
	fs.stat(location, function (error, stats) {

		// Emit error and stop
		if (error) {
			console.error('\nsimpleS: Can not read "' + location + '"');
			console.error(error.stack + '\n');
			return;
		}

		// Check if directory is provided
		if (!stats.isDirectory()) {
			console.error('\nsimpleS: "' + location + '" is not a directory\n');
			return;
		}

		// Prepare the global cache container object
		that.container.stats = stats;

		// Populate the container
		that.addDirectory(that.container, location);

		// Watch for changes
		that.watchLocation(that.container, location);
	});
};

// Read the provided location from cache
cache.prototype.read = function (location) {

	var object = this.container;

	// Get the file object
	function getFileObject(element) {

		// Check if the object represents a directory
		if (object.files && object.files[element]) {
			object = object.files[element];
		} else {
			object = null;
		}

		return object;
	}

	// Check for client API file location
	if (location === 'simples.js') {
		object = client;
	} else {
		location.split('/').every(getFileObject);
	}

	return object;
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
		} else if (current.isDirectory()) {
			object.stats = current;
			that.addDirectory(object, location);
		} else {
			object.stats = current;
			that.addFile(object, location);
		}
	});
};

// Prepare client-side simples.js content
fs.stat(__dirname + '/simples.js', function (error, stats) {

	var content = new Buffer(0);

	// Log error
	if (error) {
		console.error('\nsimpleS: Can not find "simples.js"');
		console.error(error.stack + '\n');
		return;
	}

	// Read the file
	fs.ReadStream(__dirname + '/simples.js').on('error', function (error) {
		console.error('\nsimpleS: Can not read "simples.js" content');
		console.error(error.stack + '\n');
	}).on('readable', function () {
		content = Buffer.concat([content, this.read() || new Buffer(0)]);
	}).on('end', function () {
		client = {
			stats: stats,
			content: content
		};
		client.content = content;
	});
});

module.exports = cache;