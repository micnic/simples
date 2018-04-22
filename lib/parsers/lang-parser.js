'use strict';

const {
	chars: {
		comma,
		semicolon
	}
} = require('simples/lib/utils/constants');

const langFactorDelimiter = ';q=';
const langFactorLength = langFactorDelimiter.length;

class LangParser {

	// Get the languages accepted by the client in the order of their importance
	static parse(header) {

		const langs = [];

		// Check if there is any header provided
		if (header) {

			let begin = 0;
			let end = 0;

			// Parse langs char by char
			while (header[begin]) {

				// Get the end index of the language name
				end = LangParser.getNameEndIndex(header, begin);

				const name = header.slice(begin, end).trim();

				let quality = 1;

				// Get the quality factor of the language
				if (header.startsWith(langFactorDelimiter, end)) {

					// Set the begin index for the quality factor
					begin = end + langFactorLength;

					// Get the end index of the lang quality factor
					end = LangParser.getNextLangDelimiterIndex(header, begin);

					// Get the numeric value of the quality factor
					quality = Number(header.slice(begin, end));
				}

				// Add the current language to the set
				langs.push({
					name,
					quality
				});

				// Prepare the begin and end indexes for the next cookie
				begin = end + 1;
			}
		}

		return langs.sort((first, second) => {
			return second.quality - first.quality;
		}).map((lang) => {
			return lang.name;
		});
	}

	// Get the end index of the name of tha lang
	static getNameEndIndex(header, index) {

		let char = header[index];

		// Loop until lang name is found
		while (char && char !== comma && char !== semicolon) {
			index++;
			char = header[index];
		}

		return index;
	}

	// Get the index of the next lang delimiter
	static getNextLangDelimiterIndex(header, index) {

		// Loop until the lang delimiter is found
		while (header[index] && header[index] !== comma) {
			index++;
		}

		return index;
	}
}

module.exports = LangParser;