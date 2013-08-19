'use strict';

var fs = require('fs');

// File cache prototype constructor
var cache = function (location) {

	var that = this;

	// The container for the cached content
	this.container = {
		files: {},
		stats: null
	};

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

// Cache the provided directory
cache.prototype.addDirectory = function (object, location) {

	var that = this;

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
			that.checkElement(object, location + '/' + element, element);
		});
	});
};

// Cache the provided file
cache.prototype.addFile = function (object, location) {
	fs.ReadStream(location).on('error', function (error) {
		console.error('\nsimpleS: Can not read "' + location + '"');
		console.error(error.stack + '\n');
	}).on('readable', function () {
		object.content = Buffer.concat([
			object.content,
			this.read() || new Buffer(0)
		]);
	});
};

// Check the stats of the provided location
cache.prototype.checkElement = function (object, location, name) {

	var element = object.files[name],
		modified = true,
		that = this;

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
		}

		// Create a new object with stats for element if modified
		if (modified) {
			object.files[name] = {};
			object.files[name].stats = stats;
			that.watchLocation(object, location, name);
		}

		// Check if element is not in cache or is modified
		if (modified && stats.isDirectory()) {
			object.files[name].files = {};
			that.addDirectory(object.files[name], location);
		} else if (modified && !stats.isDirectory()) {
			object.files[name].content = new Buffer(0);
			that.addFile(object.files[name], location, name);
		}
	});
};

// Read the provided location from cache
cache.prototype.read = function (location) {

	var object = this.container;

	if (location === 'simples.js') {
		return cache.client;
	}

	// Get the location components
	location.split('/').every(function (element) {
		if (object && object.files && object.files[element]) {
			object = object.files[element];
		} else {
			object = null;
		}

		return object;
	});

	return object;
};

// Watch the location for changes and make changes in the cache
cache.prototype.watchLocation = function (object, location, name) {

	var that = this;

	fs.watchFile(location, {
		persistent: false
	}, function (current) {
		if (!current.nlink && object === that.container) {
			that.container = {};
			fs.unwatchFile(location);
		} else if (!current.nlink && object !== that.container) {
			delete object.files[name];
			fs.unwatchFile(location);
		} else if (current.isDirectory()) {
			object.files = {};
			object.stats = current;
			that.addDirectory(object, location);
		} else {
			object.content = new Buffer(0);
			object.stats = current;
			that.addFile(object, location, name);
		}
	});
};

// Prepare client-side simples.js content
fs.stat(__dirname + '/simples.js', function (error, stats) {

	// Log error
	if (error) {
		console.error('\nsimpleS: Can not find "simples.js"');
		console.error(error.stack + '\n');
		return;
	}

	// Read the file
	fs.readFile(__dirname + '/simples.js', function (error, content) {

		if (error) {
			console.error('\nsimpleS: Can not read "simples.js" content');
			console.error(error.stack + '\n');
			return;
		}

		// Set up file components
		cache.client = {
			stats: stats,
			content: content
		};
	});
});

module.exports = cache;