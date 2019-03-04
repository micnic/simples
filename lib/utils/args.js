'use strict';

class Args {

	// Normalize optional arguments
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