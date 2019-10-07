'use strict';

const comma = ',';
const factorDelimiter = ';q=';
const factorLength = factorDelimiter.length;
const semicolon = ';';

class QValueParser {

	/**
	 * Get the values accepted by the client in the order of their importance
	 * @param {string} header
	 * @param {boolean} lowercase
	 * @returns {string[]}
	 */
	static parse(header, lowercase) {

		const values = [];

		// Check if there is any header provided
		if (header) {

			let begin = 0;
			let end = 0;

			// Parse values char by char
			while (header[begin]) {

				// Get the end index of the value
				end = QValueParser.getValueEndIndex(header, begin);

				const name = header.slice(begin, end).trim();

				let quality = 1;

				// Get the quality factor of the value
				if (header.startsWith(factorDelimiter, end)) {

					// Set the begin index for the quality factor
					begin = end + factorLength;

					// Get the end index of the quality factor
					end = QValueParser.getNextDelimiterIndex(header, begin);

					// Get the numeric value of the quality factor
					quality = Number(header.slice(begin, end));
				}

				// Add the current value to the set
				values.push({
					name,
					quality
				});

				// Prepare the begin and end indexes for the next value
				begin = end + 1;
			}
		}

		return values.sort((first, second) => {
			return second.quality - first.quality;
		}).map(({ name }) => {

			// Check if values should be lowercase
			if (lowercase) {
				return name.toLowerCase();
			}

			return name;
		});
	}

	/**
	 * Get the end index of the value name
	 * @param {string} header
	 * @param {number} index
	 */
	static getValueEndIndex(header, index) {

		let char = header[index];
		let i = index;

		// Loop until value name is found
		while (char && char !== comma && char !== semicolon) {
			i++;
			char = header[i];
		}

		return i;
	}

	/**
	 * Get the index of the next value delimiter
	 * @param {string} header
	 * @param {number} index
	 */
	static getNextDelimiterIndex(header, index) {

		let i = index;

		// Loop until the value delimiter is found
		while (header[i] && header[i] !== comma) {
			i++;
		}

		return i;
	}
}

module.exports = QValueParser;