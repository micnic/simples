'use strict';

// Parse data with content-type application/json
var jsonParser = function () {
	this.content = '';
	this.result = null;
};

// Parse received data
jsonParser.prototype.parse = function (data) {

	// Parse data when all the chunks are received
	if (data === null) {
		this.result = JSON.parse(this.content);
	} else {
		this.content += data;
	}
};

// Export the parser
module.exports = jsonParser;