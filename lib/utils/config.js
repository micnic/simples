'use strict';

const { isArray } = Array;
const { assign, keys } = Object;

class Config {

	/**
	 * Return array option if available or use the default option
	 * @param {*[]} option
	 * @param {*[]} defaultOption
	 * @returns {*[]}
	 */
	static getArrayOption(option, defaultOption) {

		// Check for array option provided
		if (isArray(option)) {
			return option;
		}

		return defaultOption;
	}

	/**
	 * Return boolean option, true for true option and false for any other case
	 * @param {boolean} option
	 * @param {boolean} defaultOption
	 * @returns {boolean}
	 */
	static getBooleanOption(option, defaultOption = false) {

		// Check for boolean option provided
		if (typeof option === 'boolean') {
			return option;
		}

		return defaultOption;
	}

	/**
	 * Extract configuration based on the schema and provided configs
	 * @param {*} schema
	 * @param {*[]} configs
	 * @returns {*}
	 */
	static getConfig(schema, ...configs) {

		const config = {};
		// TODO: use object spread in Node 10+
		const mergedConfig = assign({}, ...configs);

		// Loop through the schema to get config definitions
		keys(schema).forEach((key) => {

			const definition = schema[key];
			const option = mergedConfig[key];
			const configDefinition = Config.definitions[definition.type];

			// Set config value based on the provided definition and option
			config[key] = configDefinition(option, definition);
		});

		return config;
	}

	/**
	 * Return enable option, which can be a boolean or a function option
	 * @param {Enabled} option
	 * @returns {Enabled}
	 */
	static getEnableOption(option) {

		// Check for option type
		if (typeof option === 'function') {
			return option;
		}

		return (option === true);
	}

	/**
	 * Return function option or null in any other case
	 * @param {Function} option
	 * @return {Function}
	 */
	static getFunctionOption(option) {

		// Check for function option provided
		if (typeof option === 'function') {
			return option;
		}

		return null;
	}

	/**
	 * Return option from a set or use the default option
	 * @param {string} option
	 * @param {Set} set
	 * @param {string} defaultOption
	 * @returns {string}
	 */
	static getSetOption(option, set, defaultOption) {

		// Check if the option is available in the set
		if (set.has(option)) {
			return option;
		}

		return defaultOption;
	}

	/**
	 * Return number option or use the default option
	 * @param {number} option
	 * @param {number} defaultOption
	 * @param {number}
	 */
	static getNumberOption(option, defaultOption) {

		// Check for number type and greater that zero value
		if (typeof option === 'number' && option >= 0) {
			return option;
		}

		return defaultOption;
	}

	/**
	 * Return object option, use the default option if available or null if not
	 * @param {*} option
	 * @param {*} defaultOption
	 * @returns {*}
	 */
	static getObjectOption(option, defaultOption) {

		// Check for option object type
		if (option && typeof option === 'object') {
			return option;
		} else if (defaultOption) {
			return new defaultOption();
		}

		return null;
	}

	/**
	 * Return string option or empty string in any other case
	 * @param {string} option
	 * @returns {string}
	 */
	static getStringOption(option) {

		// Check string option provided
		if (typeof option === 'string') {
			return option;
		}

		return '';
	}

	/**
	 * Check if the option is enabled for the subject
	 * @param {Enabled} option
	 * @param {*} subject
	 * @returns {boolean}
	 */
	static isEnabled(option, subject) {

		// Check for enable function
		if (typeof option === 'function') {
			return option(subject);
		}

		return option;
	}

	/**
	 * Set the source configuration into destination based on the schema
	 * @param {*} schema
	 * @param {*} destination
	 * @param {*} source
	 */
	static setConfig(schema, destination, source) {

		const { definitions } = Config;

		// Loop through the schema to get config definitions
		if (source && typeof source === 'object') {
			keys(source).forEach((key) => {

				const definition = schema[key];

				if (definition) {

					const option = source[key];
					const configDefinition = definitions[definition.type];

					// Set config value based on provided option and definition
					destination[key] = configDefinition(option, definition);
				}
			});
		}
	}
}

// Set config definitions
Config.definitions = {
	array(option, definition) {

		return Config.getArrayOption(option, definition.default);
	},
	boolean(option, definition) {

		return Config.getBooleanOption(option, definition.default);
	},
	enable(option) {

		return Config.getEnableOption(option);
	},
	function(option) {

		return Config.getFunctionOption(option);
	},
	number(option, definition) {

		return Config.getNumberOption(option, definition.default);
	},
	object(option, definition) {

		return Config.getObjectOption(option, definition.default);
	},
	set(option, definition) {

		return Config.getSetOption(option, definition.set, definition.default);
	},
	string(option) {

		return Config.getStringOption(option);
	}
};

// Set config types
Config.types = {
	array: 'array',
	boolean: 'boolean',
	enable: 'enable',
	function: 'function',
	number: 'number',
	object: 'object',
	set: 'set',
	string: 'string'
};

module.exports = Config;