'use strict';

class Args {

	/**
	 * Normalize optional arguments
	 * @param {string[]} types
	 * @param {*[]} args
	 * @returns {*[]}
	 */
	static getArgs(types, ...args) {

		return types.reduce((result, type, index) => {

			// Check for different type to insert a default argument
			if (typeof result[index] !== type) {
				result.splice(index, 0, null);
			}

			return result;
		}, args);
	}
}

module.exports = Args;