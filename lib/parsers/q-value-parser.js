'use strict';

const comma = ',';
const factorDelimiter = ';q=';
const factorLength = factorDelimiter.length;
const semicolon = ';';

class QValueParser {

	// Get the values accepted by the client in the order of their importance
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
		}).map((value) => {

			let name = value.name;

			// Check if values should be lowercase
			if (lowercase) {
				name = name.toLowerCase();
			}

			return name;
		});
	}

	// Get the end index of the value name
	static getValueEndIndex(header, index) {

		let char = header[index];

		// Loop until value name is found
		while (char && char !== comma && char !== semicolon) {
			index++;
			char = header[index];
		}

		return index;
	}

	// Get the index of the next value delimiter
	static getNextDelimiterIndex(header, index) {

		// Loop until the value delimiter is found
		while (header[index] && header[index] !== comma) {
			index++;
		}

		return index;
	}
}

module.exports = QValueParser;