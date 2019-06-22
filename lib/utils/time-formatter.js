'use strict';

const { now } = Date;

const dateFormatSlice = 2; // Slice from the date format to get last to digits
const second = 1000; // Milliseconds in one second

class TimeFormatter {

	/**
	 * Transform number value to two digits numeric string
	 * @param {number} value
	 * @returns {string}
	 */
	static toTwoDigits(value) {

		return String(value).padStart(dateFormatSlice, '0');
	}

	/**
	 * Generate UTC string for a numeric time value
	 * @param {number} time
	 * @returns {string}
	 */
	static utcFormat(time) {

		return new Date(now() + (time * second)).toUTCString();
	}
}

module.exports = TimeFormatter;