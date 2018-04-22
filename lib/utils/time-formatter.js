'use strict';

const { second } = require('simples/lib/utils/constants');

class TimeFormatter {

	// Generate UTC string for a numeric time value
	static utcFormat(time) {

		return new Date(Date.now() + (time * second)).toUTCString();
	}
}

module.exports = TimeFormatter;