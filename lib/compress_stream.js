var stream = require('stream');
var zlib = require('zlib');

function compressStream(encoding) {

	// ES5 strict syntax
	'use strict';

	// Ignore new keyword
	if (!(this instanceof compressStream)) {
		return new compressStream(encoding);
	}

	stream.call(this);

	this.encoding = encoding;
	this.paused = true;
	this.processed = false;
	this.result = Buffer(0);
	this.readable = true;
	this.writable = true;
}

// Inherit from stream
compressStream.prototype = Object.create(stream.prototype, {
	constructor: {
		value: compressStream,
		enumerable: false,
		writable: true,
		configurable: true
	}
});

// End to add data to the content
compressStream.prototype.end = function (data) {
	if (data) {
		this.write(data);
	}
	this.writable = false;
	this.process();
};

// Stops for a while the reading of the compression content
compressStream.prototype.pause = function () {
	this.paused = true;
};

// Compress content with specific encoding
compressStream.prototype.process = function () {
	var that = this;
	zlib[this.encoding](this.result, function (error, result) {
		that.result = result;
		that.processed = true;
		that.resume();
	});
};

// Read and fragment compressed content
compressStream.prototype.read = function () {

	var that = this;

	function read() {
		// Do nothing if the stream has not content, is paused or is not readable
		if (that.result.length === 0 || that.paused || !that.readable) {
			return;
		}

		// Get next 64 kilobytes to read
		var readData;
		if (that.result.length > 65536) {
			readData = that.result.slice(0, 65536);
			that.result = that.result.slice(65536);
		} else {
			readData = that.result;
			that.result = Buffer(0);
		}

		// Emit data and wait for next loop to read data
		that.emit('data', readData);
		process.nextTick(read);

		// Stop stream if there is nothing to read and the content is processed
		if (that.result.length === 0 && that.processed) {
			that.readable = false;
			that.emit('end');
		}
	}

	read();
};

// Resume the reading of compression content
compressStream.prototype.resume = function () {
	if (this.paused) {
		this.paused = false;
		this.read();
	}
};

// Add data to the content
compressStream.prototype.write = function (data) {
	if (!this.writable) {
		return;
	}
	data = Buffer(String(data));
	this.result = Buffer.concat([this.result, data]);
	return true;
};

module.exports = compressStream;